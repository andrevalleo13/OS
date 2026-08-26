import { logFood } from "./src/app/actions/nutrition";
import { config } from "dotenv";
config({ path: ".env.local" });

async function test() {
  try {
    const res = await logFood("sopa y dos tacos");
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
