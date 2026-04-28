import process from 'process';

console.log("--- GEMINI API KEY CHECK ---");
const key = process.env.GEMINI_API_KEY;

if (!key) {
  console.log("Result: NULL or UNDEFINED");
} else if (key.length < 5) {
  console.log("Result: TOO SHORT (Length: " + key.length + ")");
} else {
  console.log("Result: PRESENT");
  console.log("Length:", key.length);
  console.log("Starts with:", key.substring(0, 4) + "...");
}
