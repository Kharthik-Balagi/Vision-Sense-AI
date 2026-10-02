#include <DHT.h>

// =====================================================
// PIN DEFINITIONS
// =====================================================

#define Z1_LIGHT 2
#define Z2_LIGHT 3

#define IR_SENSOR 4

#define DHT_PIN 5
#define DHT_TYPE DHT22

#define Z2_FAN 6
#define Z1_FAN 8


// =====================================================
// DHT22
// =====================================================

DHT dht(DHT_PIN, DHT_TYPE);


// =====================================================
// SYSTEM SETTINGS
// =====================================================

const unsigned long TEMP_INTERVAL = 2000;
const unsigned long HEARTBEAT_TIMEOUT = 3000;


// =====================================================
// SYSTEM VARIABLES
// =====================================================

bool systemActive = false;

unsigned long lastTemperatureRead = 0;
unsigned long lastHeartbeat = 0;


// =====================================================
// IR WAKE VARIABLES
// =====================================================

int lastIRState = HIGH;


// =====================================================
// TURN EVERYTHING OFF
// =====================================================

void allOutputsOff() {

  // LEDs OFF
  digitalWrite(Z1_LIGHT, LOW);
  digitalWrite(Z2_LIGHT, LOW);

  // Relay modules are ACTIVE LOW
  // HIGH = FAN OFF
  digitalWrite(Z1_FAN, HIGH);
  digitalWrite(Z2_FAN, HIGH);
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(9600);

  pinMode(Z1_LIGHT, OUTPUT);
  pinMode(Z2_LIGHT, OUTPUT);

  pinMode(IR_SENSOR, INPUT);

  pinMode(Z1_FAN, OUTPUT);
  pinMode(Z2_FAN, OUTPUT);

  dht.begin();

  allOutputsOff();

  lastIRState = digitalRead(IR_SENSOR);

  Serial.println("ARDUINO_READY");
}


// =====================================================
// PROCESS COMMAND FROM PYTHON
// =====================================================

void processCommand(String command) {

  command.trim();


  // ---------------------------------------------------
  // SYSTEM READY
  // ---------------------------------------------------

  if (command == "SYSTEM_READY") {

    systemActive = true;

    lastHeartbeat = millis();

    allOutputsOff();

    Serial.println("SYSTEM_ACTIVE");
  }


  // ---------------------------------------------------
  // ZONE 1 LIGHT
  // ---------------------------------------------------

  else if (command == "Z1_LIGHT_ON") {

    digitalWrite(Z1_LIGHT, HIGH);
  }

  else if (command == "Z1_LIGHT_OFF") {

    digitalWrite(Z1_LIGHT, LOW);
  }


  // ---------------------------------------------------
  // ZONE 2 LIGHT
  // ---------------------------------------------------

  else if (command == "Z2_LIGHT_ON") {

    digitalWrite(Z2_LIGHT, HIGH);
  }

  else if (command == "Z2_LIGHT_OFF") {

    digitalWrite(Z2_LIGHT, LOW);
  }


  // ---------------------------------------------------
  // ZONE 1 FAN
  // ---------------------------------------------------

  else if (command == "Z1_FAN_ON") {

    digitalWrite(Z1_FAN, LOW);
  }

  else if (command == "Z1_FAN_OFF") {

    digitalWrite(Z1_FAN, HIGH);
  }


  // ---------------------------------------------------
  // ZONE 2 FAN
  // ---------------------------------------------------

  else if (command == "Z2_FAN_ON") {

    digitalWrite(Z2_FAN, LOW);
  }

  else if (command == "Z2_FAN_OFF") {

    digitalWrite(Z2_FAN, HIGH);
  }


  // ---------------------------------------------------
  // HEARTBEAT
  // ---------------------------------------------------

  else if (command == "HEARTBEAT") {

    lastHeartbeat = millis();
  }


  // ---------------------------------------------------
  // ENTER STANDBY
  // ---------------------------------------------------

  else if (command == "STANDBY") {

    systemActive = false;

    allOutputsOff();

    // Remember current IR state.
    // This prevents an already-active IR sensor
    // from immediately triggering another wake.
    lastIRState = digitalRead(IR_SENSOR);

    Serial.println("STANDBY");
  }


  // ---------------------------------------------------
  // COMPLETE STOP
  // ---------------------------------------------------

  else if (command == "SYSTEM_STOP") {

    systemActive = false;

    allOutputsOff();

    Serial.println("SYSTEM_STOPPED");
  }
}


// =====================================================
// READ SERIAL COMMANDS
// =====================================================

void readSerialCommands() {

  while (Serial.available() > 0) {

    String command = Serial.readStringUntil('\n');

    processCommand(command);
  }
}


// =====================================================
// READ TEMPERATURE
// =====================================================

void readTemperature() {

  if (!systemActive) {
    return;
  }

  if (millis() - lastTemperatureRead < TEMP_INTERVAL) {
    return;
  }

  lastTemperatureRead = millis();

  float temperature = dht.readTemperature();

  if (isnan(temperature)) {

    Serial.println("TEMP_ERROR");

    return;
  }

  Serial.print("TEMP:");
  Serial.println(temperature, 1);
}


// =====================================================
// CHECK HEARTBEAT
// =====================================================

void checkHeartbeat() {

  if (!systemActive) {
    return;
  }

  if (millis() - lastHeartbeat > HEARTBEAT_TIMEOUT) {

    // Python stopped communicating.
    // Turn everything OFF for safety.

    allOutputsOff();

    lastHeartbeat = millis();
  }
}


// =====================================================
// CHECK IR SENSOR
// =====================================================

void checkIRWake() {

  if (systemActive) {
    return;
  }

  int currentIRState = digitalRead(IR_SENSOR);


  // Detect HIGH -> LOW transition
  // LOW means person/object detected.

  if (lastIRState == HIGH && currentIRState == LOW) {

    Serial.println("WAKE");
  }


  lastIRState = currentIRState;
}


// =====================================================
// MAIN LOOP
// =====================================================

void loop() {

  readSerialCommands();

  checkIRWake();

  readTemperature();

  checkHeartbeat();

  delay(10);
}