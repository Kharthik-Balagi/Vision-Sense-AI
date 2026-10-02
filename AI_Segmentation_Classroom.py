import cv2
import time
import serial
import gc
import json
import math
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from ultralytics import YOLO


# =========================================================
# SETTINGS
# =========================================================

MODEL_PATH = "yolo11n-seg.pt"

SERIAL_PORT = "COM6"
BAUD_RATE = 9600

CAMERA_INDEX = 0

CONFIDENCE = 0.50

# Person must have more than 50% of body in a zone
ZONE_THRESHOLD = 50.0

# Number of stable frames before changing zone state
STABILITY_FRAMES = 5

# Arduino heartbeat
HEARTBEAT_INTERVAL = 0.5

# If nobody is detected for this long,
# camera and YOLO go to standby
NO_PERSON_TIME = 3

# Camera/AI performance settings
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FPS = 30
YOLO_IMGSZ = 416

# Ignore tiny false detections
MIN_PERSON_PIXELS = 1000

# =========================================================
# TEMPERATURE SETTINGS
# =========================================================

TEMPERATURE_THRESHOLD = 29.0

# If temperature data becomes old,
# turn fans OFF
TEMPERATURE_TIMEOUT = 5


# =========================================================
# ARDUINO CONNECTION
# =========================================================

arduino = None
last_serial_attempt = 0.0
SERIAL_RETRY_INTERVAL = 2.0


# =========================================================
# ARDUINO CONNECTION
# =========================================================
def try_connect_arduino():
    global arduino, last_serial_attempt

    now = time.time()
    if arduino is not None and arduino.is_open:
        return True

    if now - last_serial_attempt < SERIAL_RETRY_INTERVAL:
        return False

    last_serial_attempt = now

    try:
        print("Connecting to Arduino...")
        candidate = serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=0.05,
            write_timeout=2
        )
        time.sleep(2)
        candidate.reset_input_buffer()
        arduino = candidate
        update_runtime_state(connected=True)
        print("Arduino connected.")
        return True
    except (serial.SerialException, OSError) as error:
        arduino = None
        update_runtime_state(connected=False)
        print(f"Arduino not connected — check USB cable ({error})")
        return False


# =========================================================
# SEND COMMAND
# =========================================================

def send_command(command):

    if not try_connect_arduino():
        update_runtime_state(connected=False)
        return False

    try:
        arduino.write(
            (command + "\n").encode()
        )
        arduino.flush()

        print("Arduino:", command)
        update_runtime_state(connected=True)
        return True

    except (serial.SerialException, OSError) as error:
        print("Serial error — Arduino USB may be disconnected:", error)
        update_runtime_state(connected=False)

        try:
            arduino.close()
        except Exception:
            pass

        arduino = None
        return False


# =========================================================
# READ ARDUINO MESSAGES
# =========================================================

current_temperature = None
last_temperature_time = 0


def read_arduino_messages():

    global current_temperature
    global last_temperature_time
    global arduino

    if not try_connect_arduino():
        update_runtime_state(connected=False)
        return

    try:
        while arduino.in_waiting > 0:
            message = (
                arduino.readline()
                .decode(errors="ignore")
                .strip()
            )

            if not message:
                continue

            if message.startswith("TEMP:"):
                try:
                    value = float(message.replace("TEMP:", ""))
                    current_temperature = value
                    last_temperature_time = time.time()

                    with status_lock:
                        website_status["temperature"] = value
                        website_status["temperature_valid"] = True
                        website_status["cooling_allowed"] = value > TEMPERATURE_THRESHOLD
                except ValueError:
                    pass
            else:
                print("Arduino:", message)

        update_runtime_state(connected=arduino is not None and arduino.is_open)

    except (serial.SerialException, OSError) as error:
        print("Serial read error — Arduino USB may be disconnected:", error)
        update_runtime_state(connected=False)

        try:
            arduino.close()
        except Exception:
            pass

        arduino = None

# =========================================================
# TEMPERATURE CONDITION
# =========================================================

def cooling_allowed():

    if current_temperature is None:

        return False

    if (
        time.time() - last_temperature_time
        > TEMPERATURE_TIMEOUT
    ):

        return False

    return current_temperature > TEMPERATURE_THRESHOLD


# =========================================================
# CAMERA
# =========================================================

def open_camera():

    print("Opening camera...")

    camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(CAMERA_INDEX)

    if not camera.isOpened():

        print("ERROR: Camera could not be opened.")

        camera.release()

        return None

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    camera.set(cv2.CAP_PROP_FPS, CAMERA_FPS)
    camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    print("Camera ON.")

    return camera


# =========================================================
# CLOSE CAMERA
# =========================================================

def close_camera(camera):

    if camera is not None:

        print("Releasing camera...")

        camera.release()

    cv2.destroyAllWindows()

    time.sleep(0.5)

    print("Camera OFF.")


# =========================================================
# LOAD YOLO
# =========================================================

def load_ai():

    print("Loading YOLO11...")

    model = YOLO(MODEL_PATH)

    # Warm up the model once so the first live detection is not delayed.
    try:
        dummy = __import__("numpy").zeros((YOLO_IMGSZ, YOLO_IMGSZ, 3), dtype="uint8")
        model.predict(dummy, imgsz=YOLO_IMGSZ, conf=CONFIDENCE, classes=[0], verbose=False)
    except Exception as error:
        print(f"YOLO warm-up skipped: {error}")

    print("YOLO11 READY.")

    return model


# =========================================================
# INITIAL VARIABLES
# =========================================================

model = None
cap = None
show_preview = True

ai_active = False


# LIGHT STATES
zone1_light_state = False
zone2_light_state = False


# FAN STATES
zone1_fan_state = False
zone2_fan_state = False


# LOCAL WEBSITE STATUS
status_lock = threading.Lock()
status_server = None
zone1_state = False
zone2_state = False
runtime_data_path = Path(__file__).resolve().with_name("runtime_data.json")
runtime_totals = {
    "zone1_fan": 0.0,
    "zone1_light": 0.0,
    "zone2_fan": 0.0,
    "zone2_light": 0.0,
}
runtime_started_at = {
    "zone1_fan": None,
    "zone1_light": None,
    "zone2_fan": None,
    "zone2_light": None,
}
website_status = {
    "connected": False,
    "ai_active": False,
    "zone1": False,
    "zone2": False,
    "zone1_fan": False,
    "zone1_light": False,
    "zone2_fan": False,
    "zone2_light": False,
    "temperature": None,
    "temperature_valid": False,
    "cooling_allowed": False,
}


def load_runtime_data():
    """Load saved device runtimes, defaulting invalid or missing values to zero."""

    try:
        with runtime_data_path.open("r", encoding="utf-8") as runtime_file:
            saved_data = json.load(runtime_file)
    except FileNotFoundError:
        return {device: 0.0 for device in runtime_totals}
    except (OSError, ValueError) as error:
        print(f"Runtime data could not be loaded; starting from zero: {error}")
        return {device: 0.0 for device in runtime_totals}

    if not isinstance(saved_data, dict):
        print("Runtime data is invalid; starting from zero.")
        return {device: 0.0 for device in runtime_totals}

    loaded_totals = {}
    for device in runtime_totals:
        value = saved_data.get(device, 0)
        try:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("Runtime value must be numeric.")

            value = float(value)
            if not math.isfinite(value) or value < 0:
                value = 0.0
        except (OverflowError, ValueError):
            value = 0.0

        loaded_totals[device] = value

    return loaded_totals


def save_runtime_data():
    """Atomically save accumulated runtimes without persisting active periods."""

    temporary_path = None

    try:
        with status_lock:
            saved_totals = dict(runtime_totals)

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=runtime_data_path.parent,
            prefix=f"{runtime_data_path.name}.",
            suffix=".tmp",
            delete=False
        ) as runtime_file:
            temporary_path = Path(runtime_file.name)
            json.dump(saved_totals, runtime_file, indent=2)
            runtime_file.write("\n")
            runtime_file.flush()
            os.fsync(runtime_file.fileno())

        os.replace(temporary_path, runtime_data_path)

    except OSError as error:
        print(f"Runtime data could not be saved: {error}")

    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass
            except OSError as error:
                print(f"Temporary runtime data could not be removed: {error}")


runtime_totals.update(load_runtime_data())
save_runtime_data()


def update_runtime_state(
    *,
    connected=None,
    ai_active=None,
    zone1=None,
    zone2=None,
    zone1_fan=None,
    zone1_light=None,
    zone2_fan=None,
    zone2_light=None
):
    """Update shared website state and account for device ON periods."""

    now = time.monotonic()
    device_turned_off = False

    with status_lock:

        for key, value in (
            ("connected", connected),
            ("ai_active", ai_active),
            ("zone1", zone1),
            ("zone2", zone2),
        ):
            if value is not None:
                website_status[key] = bool(value)

        # This program already tracks fan and light outputs separately; mirror
        # their actual states, including the temperature-controlled fan state.
        device_updates = {
            "zone1_fan": zone1_fan,
            "zone1_light": zone1_light,
            "zone2_fan": zone2_fan,
            "zone2_light": zone2_light,
        }

        for device, is_on in device_updates.items():

            if is_on is None:
                continue

            is_on = bool(is_on)
            was_on = website_status[device]

            if is_on == was_on:
                continue

            if is_on:
                runtime_started_at[device] = now
            else:
                started_at = runtime_started_at[device]

                if started_at is not None:
                    runtime_totals[device] += now - started_at

                runtime_started_at[device] = None
                device_turned_off = True

            website_status[device] = is_on

    if device_turned_off:
        save_runtime_data()


def get_website_status():
    """Return a thread-safe snapshot with current ON time included."""

    now = time.monotonic()

    with status_lock:
        snapshot = dict(website_status)

        temperature_is_valid = (
            current_temperature is not None
            and time.time() - last_temperature_time <= TEMPERATURE_TIMEOUT
        )
        snapshot["temperature_valid"] = temperature_is_valid
        snapshot["temperature"] = current_temperature if temperature_is_valid else None
        snapshot["cooling_allowed"] = (
            bool(current_temperature > TEMPERATURE_THRESHOLD)
            if temperature_is_valid
            else False
        )

        for device, accumulated in runtime_totals.items():
            started_at = runtime_started_at[device]
            current_period = now - started_at if started_at is not None else 0
            snapshot[f"{device}_runtime"] = int(accumulated + current_period)

        return snapshot


class WebsiteStatusHandler(BaseHTTPRequestHandler):

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):

        if urlsplit(self.path).path != "/status":
            body = b"Not found"
            self.send_response(404)
            self.send_cors_headers()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = json.dumps(get_website_status()).encode("utf-8")
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def start_status_server():

    global status_server

    if status_server is not None:
        return

    status_server = ThreadingHTTPServer(
        ("127.0.0.1", 8765),
        WebsiteStatusHandler
    )
    status_server.daemon_threads = True

    server_thread = threading.Thread(
        target=status_server.serve_forever,
        name="local-website-status",
        daemon=True
    )
    server_thread.start()

    print("======================================")
    print("LOCAL WEBSITE SERVER")
    print("http://127.0.0.1:8765/status")
    print("======================================")


# ZONE STABILITY
zone1_counter = 0
zone2_counter = 0


# TIMERS
last_person_seen = time.time()
last_heartbeat = time.time()

start_status_server()


# =========================================================
# START AI
# =========================================================

cap = open_camera()

model = load_ai()

if cap is None:

    update_runtime_state(connected=False)

    raise SystemExit


send_command("SYSTEM_READY")

ai_active = True
update_runtime_state(ai_active=True)

last_person_seen = time.time()
last_heartbeat = time.time()


print()
print("======================================")
print("        VISION SENSE SYSTEM")
print("======================================")
print("Camera       : ON")
print("YOLO11       : ON")
print("Temperature  : ON")
print("Threshold    : 29.0 C")
print("IR standby   : OFF")
print("======================================")
print()


# =========================================================
# MAIN PROGRAM
# =========================================================

try:

    while True:


        # =================================================
        # AI MODE
        # =================================================

        if ai_active:

            # Reconnect automatically if the USB cable was removed and later restored.
            try_connect_arduino()

            # ---------------------------------------------
            # READ ARDUINO DATA
            # ---------------------------------------------

            read_arduino_messages()


            # ---------------------------------------------
            # MAKE SURE CAMERA EXISTS
            # ---------------------------------------------

            if cap is None:

                cap = open_camera()

                if cap is None:

                    time.sleep(1)

                    continue


            # ---------------------------------------------
            # READ CAMERA
            # ---------------------------------------------

            ret, frame = cap.read()

            if not ret:

                print("Camera frame error.")

                close_camera(cap)

                cap = None

                time.sleep(1)

                continue


            height, width = frame.shape[:2]

            middle = width // 2


            # ---------------------------------------------
            # YOLO
            # ---------------------------------------------

            results = model(
                frame,
                conf=CONFIDENCE,
                classes=[0],
                imgsz=YOLO_IMGSZ,
                verbose=False
            )


            detected_zone1 = False
            detected_zone2 = False

            person_detected = False


            # ---------------------------------------------
            # ZONE DIVIDER
            # ---------------------------------------------

            cv2.line(
                frame,
                (middle, 0),
                (middle, height),
                (255, 255, 255),
                2
            )


            # ---------------------------------------------
            # PROCESS PERSONS
            # ---------------------------------------------

            for result in results:

                if result.masks is None:
                    continue


                for mask in result.masks.data:

                    mask = mask.cpu().numpy()


                    mask = cv2.resize(
                        mask,
                        (width, height),
                        interpolation=cv2.INTER_NEAREST
                    )


                    body = mask > 0.5


                    total_body_pixels = body.sum()


                    # Ignore tiny false detections
                    if total_body_pixels < MIN_PERSON_PIXELS:
                        continue


                    person_detected = True


                    # -------------------------------------
                    # ZONE PIXELS
                    # -------------------------------------

                    zone1_pixels = body[:, :middle].sum()

                    zone2_pixels = body[:, middle:].sum()


                    # -------------------------------------
                    # ZONE PERCENTAGES
                    # -------------------------------------

                    zone1_percentage = (
                        zone1_pixels /
                        total_body_pixels
                    ) * 100


                    zone2_percentage = (
                        zone2_pixels /
                        total_body_pixels
                    ) * 100


                    # -------------------------------------
                    # BODY OUTLINE
                    # -------------------------------------

                    mask_uint8 = (
                        body.astype("uint8") * 255
                    )


                    contours, _ = cv2.findContours(
                        mask_uint8,
                        cv2.RETR_EXTERNAL,
                        cv2.CHAIN_APPROX_SIMPLE
                    )


                    cv2.drawContours(
                        frame,
                        contours,
                        -1,
                        (0, 255, 255),
                        3
                    )


                    # -------------------------------------
                    # BODY CENTRE
                    # -------------------------------------

                    M = cv2.moments(mask_uint8)


                    if M["m00"] != 0:

                        cx = int(
                            M["m10"] /
                            M["m00"]
                        )

                        cy = int(
                            M["m01"] /
                            M["m00"]
                        )


                        cv2.circle(
                            frame,
                            (cx, cy),
                            6,
                            (0, 255, 255),
                            -1
                        )


                    # -------------------------------------
                    # DISPLAY ZONE %
                    # -------------------------------------

                    cv2.putText(
                        frame,
                        f"Z1: {zone1_percentage:.1f}%",
                        (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 255),
                        2
                    )


                    cv2.putText(
                        frame,
                        f"Z2: {zone2_percentage:.1f}%",
                        (middle + 20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 255),
                        2
                    )


                    # -------------------------------------
                    # 50% RULE
                    # -------------------------------------

                    if zone1_percentage > ZONE_THRESHOLD:

                        detected_zone1 = True


                    if zone2_percentage > ZONE_THRESHOLD:

                        detected_zone2 = True


            # =================================================
            # PERSON TIMER
            # =================================================

            if person_detected:

                last_person_seen = time.time()


            # =================================================
            # STABILITY FILTER
            # =================================================

            if detected_zone1:

                zone1_counter += 1

            else:

                zone1_counter = 0


            if detected_zone2:

                zone2_counter += 1

            else:

                zone2_counter = 0


            # Publish stable zone occupancy to the local status endpoint.
            current_zone1_state = zone1_counter >= STABILITY_FRAMES
            current_zone2_state = zone2_counter >= STABILITY_FRAMES

            if current_zone1_state != zone1_state:
                zone1_state = current_zone1_state
                update_runtime_state(zone1=zone1_state)

            if current_zone2_state != zone2_state:
                zone2_state = current_zone2_state
                update_runtime_state(zone2=zone2_state)


            # =================================================
            # TEMPERATURE STATUS
            # =================================================

            cooling = cooling_allowed()


            # =================================================
            # ZONE 1 LIGHT
            # =================================================

            if zone1_counter >= STABILITY_FRAMES:

                if not zone1_light_state:

                    send_command("Z1_LIGHT_ON")

                    zone1_light_state = True
                    update_runtime_state(zone1_light=zone1_light_state)


            elif zone1_counter == 0:

                if zone1_light_state:

                    send_command("Z1_LIGHT_OFF")

                    zone1_light_state = False
                    update_runtime_state(zone1_light=zone1_light_state)


            # =================================================
            # ZONE 2 LIGHT
            # =================================================

            if zone2_counter >= STABILITY_FRAMES:

                if not zone2_light_state:

                    send_command("Z2_LIGHT_ON")

                    zone2_light_state = True
                    update_runtime_state(zone2_light=zone2_light_state)


            elif zone2_counter == 0:

                if zone2_light_state:

                    send_command("Z2_LIGHT_OFF")

                    zone2_light_state = False
                    update_runtime_state(zone2_light=zone2_light_state)


            # =================================================
            # ZONE 1 FAN
            # =================================================

            if (
                zone1_counter >= STABILITY_FRAMES
                and cooling
            ):

                if not zone1_fan_state:

                    send_command("Z1_FAN_ON")

                    zone1_fan_state = True
                    update_runtime_state(zone1_fan=zone1_fan_state)


            else:

                if zone1_fan_state:

                    send_command("Z1_FAN_OFF")

                    zone1_fan_state = False
                    update_runtime_state(zone1_fan=zone1_fan_state)


            # =================================================
            # ZONE 2 FAN
            # =================================================

            if (
                zone2_counter >= STABILITY_FRAMES
                and cooling
            ):

                if not zone2_fan_state:

                    send_command("Z2_FAN_ON")

                    zone2_fan_state = True
                    update_runtime_state(zone2_fan=zone2_fan_state)


            else:

                if zone2_fan_state:

                    send_command("Z2_FAN_OFF")

                    zone2_fan_state = False
                    update_runtime_state(zone2_fan=zone2_fan_state)


            # =================================================
            # HEARTBEAT
            # =================================================

            if (
                time.time() - last_heartbeat
                >= HEARTBEAT_INTERVAL
            ):

                send_command("HEARTBEAT")

                last_heartbeat = time.time()


            # =================================================
            # NO PERSON → STANDBY
            # =================================================

            if (
                time.time() - last_person_seen
                >= NO_PERSON_TIME
            ):

                print()
                print("======================================")
                print("NO PERSON DETECTED")
                print("ENTERING STANDBY MODE")
                print("======================================")


                # -----------------------------------------
                # EVERYTHING OFF
                # -----------------------------------------

                send_command("Z1_LIGHT_OFF")
                send_command("Z2_LIGHT_OFF")

                send_command("Z1_FAN_OFF")
                send_command("Z2_FAN_OFF")


                zone1_light_state = False
                zone2_light_state = False

                zone1_fan_state = False
                zone2_fan_state = False


                zone1_counter = 0
                zone2_counter = 0

                zone1_state = False
                zone2_state = False
                update_runtime_state(
                    zone1=False,
                    zone2=False,
                    zone1_fan=False,
                    zone1_light=False,
                    zone2_fan=False,
                    zone2_light=False
                )


                # -----------------------------------------
                # ARDUINO STANDBY
                # -----------------------------------------

                send_command("STANDBY")


                # -----------------------------------------
                # CLOSE CAMERA
                # -----------------------------------------

                close_camera(cap)

                cap = None


                # -----------------------------------------
                # UNLOAD YOLO
                # -----------------------------------------

                print("Unloading YOLO11...")

                del model

                model = None

                gc.collect()


                ai_active = False
                update_runtime_state(ai_active=False)


                print("AI OFF")
                print("CAMERA OFF")
                print("IR SENSOR ACTIVE")
                print()

                continue


            # =================================================
            # DISPLAY TEMPERATURE
            # =================================================

            if current_temperature is None:

                temperature_text = "Temperature: --.- C"

            else:

                temperature_text = (
                    f"Temperature: "
                    f"{current_temperature:.1f} C"
                )


            cv2.putText(
                frame,
                temperature_text,
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2
            )


            # =================================================
            # DISPLAY COOLING STATUS
            # =================================================

            if cooling:

                cooling_text = "Cooling: ALLOWED (>29 C)"

            else:

                cooling_text = "Cooling: OFF (<=29 C)"


            cv2.putText(
                frame,
                cooling_text,
                (20, 115),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 255),
                2
            )


            # =================================================
            # DISPLAY SYSTEM STATUS
            # =================================================

            cv2.putText(
                frame,
                "VISION SENSE - AUTO MODE",
                (20, height - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2
            )


            cv2.putText(
                frame,
                f"Z1 LIGHT: "
                f"{'ON' if zone1_light_state else 'OFF'}",
                (20, height - 55),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2
            )


            cv2.putText(
                frame,
                f"Z1 FAN: "
                f"{'ON' if zone1_fan_state else 'OFF'}",
                (20, height - 85),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2
            )


            cv2.putText(
                frame,
                f"Z2 LIGHT: "
                f"{'ON' if zone2_light_state else 'OFF'}",
                (middle + 20, height - 55),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2
            )


            cv2.putText(
                frame,
                f"Z2 FAN: "
                f"{'ON' if zone2_fan_state else 'OFF'}",
                (middle + 20, height - 85),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2
            )


            # =================================================
            # CAMERA PREVIEW
            # =================================================

            if show_preview:
                try:
                    cv2.imshow(
                        "VisionSense",
                        frame
                    )

                    # If the user clicks the camera window's X, hide only
                    # the preview. AI/YOLO and classroom control continue.
                    if cv2.getWindowProperty("VisionSense", cv2.WND_PROP_VISIBLE) < 1:
                        print("Camera preview closed — AI continues in background.")
                        show_preview = False
                        cv2.destroyWindow("VisionSense")

                    else:
                        key = cv2.waitKey(1) & 0xFF

                        if key == ord("q") or key == 27:
                            print("Q pressed — complete system stop.")
                            break

                except cv2.error:
                    print("Camera preview closed — AI continues in background.")
                    show_preview = False

            else:
                # No OpenCV window is required while AI runs in the background.
                # Keep a tiny wait so the loop remains responsive.
                time.sleep(0.001)


        # =================================================
        # STANDBY MODE
        # =================================================

        else:

            try:

                try_connect_arduino()

                # Check Arduino for WAKE only when Arduino is connected.
                if arduino is None or not arduino.is_open:
                    time.sleep(0.05)
                    continue

                while arduino.in_waiting > 0:

                    message = (
                        arduino.readline()
                        .decode(errors="ignore")
                        .strip()
                    )


                    if message:

                        print("Arduino:", message)


                    if message == "WAKE":

                        print()
                        print("======================================")
                        print("IR DETECTED!")
                        print("WAKING VISION SENSE...")
                        print("======================================")


                        # ---------------------------------
                        # LOAD YOLO
                        # ---------------------------------

                        # Open the camera first so the window appears immediately.
                        cap = open_camera()
                        show_preview = True


                        # ---------------------------------
                        # LOAD YOLO
                        # ---------------------------------

                        model = load_ai()


                        if cap is None:

                            print(
                                "Camera failed to reopen."
                            )

                            del model

                            model = None

                            gc.collect()

                            continue


                        # ---------------------------------
                        # RESET STATES
                        # ---------------------------------

                        zone1_light_state = False
                        zone2_light_state = False

                        zone1_fan_state = False
                        zone2_fan_state = False

                        zone1_state = False
                        zone2_state = False
                        update_runtime_state(
                            zone1=False,
                            zone2=False,
                            zone1_fan=False,
                            zone1_light=False,
                            zone2_fan=False,
                            zone2_light=False
                        )

                        zone1_counter = 0
                        zone2_counter = 0

                        last_person_seen = time.time()
                        last_heartbeat = time.time()


                        # ---------------------------------
                        # SYSTEM READY
                        # ---------------------------------

                        send_command(
                            "SYSTEM_READY"
                        )


                        ai_active = True
                        update_runtime_state(ai_active=True)


                        print("AI ON")
                        print("CAMERA ON")
                        print("YOLO11 ON")
                        print("TEMPERATURE ON")
                        print()

                        break


            except serial.SerialException as e:

                print(
                    "Serial connection error:",
                    e
                )

                update_runtime_state(connected=False)

                time.sleep(1)


            time.sleep(0.05)


# =========================================================
# SAFE SHUTDOWN
# =========================================================

finally:

    print()
    print("Stopping VisionSense...")


    try:

        send_command("Z1_LIGHT_OFF")
        send_command("Z2_LIGHT_OFF")

        send_command("Z1_FAN_OFF")
        send_command("Z2_FAN_OFF")

        send_command("SYSTEM_STOP")

    except:

        pass

    update_runtime_state(
        ai_active=False,
        zone1=False,
        zone2=False,
        zone1_fan=False,
        zone1_light=False,
        zone2_fan=False,
        zone2_light=False
    )
    save_runtime_data()


    # Close camera

    if cap is not None:

        cap.release()


    cv2.destroyAllWindows()


    # Unload model

    if model is not None:

        del model

        gc.collect()


    # Close Arduino

    try:
        if arduino is not None:
            arduino.close()
        update_runtime_state(connected=False)
    except Exception:
        update_runtime_state(connected=False)


    print("VisionSense stopped safely.")
