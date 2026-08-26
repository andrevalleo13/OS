# Nutrition Module v3.0

The ValleOS Nutrition Module is a fully AI-driven macro and calorie tracking system designed to eliminate manual data entry.

## Architecture

### 1. Review-first conversational input
The dedicated nutrition composer uses a two-phase workflow so an AI estimate never becomes trusted data silently.
- **Analyze (`analyzeFood`)**: Shadow separates ingredients, quantities, units, calories, macros, water, assumptions and confidence without writing to the database.
- **Review:** The user can answer one clarification question, change portions, edit macros, add/remove ingredients or discard the draft.
- **Confirm (`confirmFoodLog`)**: Server-side validation recalculates canonical totals from the reviewed ingredient rows and only then writes the `FoodLog`.
- **Compatibility (`logFood`)**: The global Shadow tool keeps a direct confirmed logging path when the user has explicitly stated that the meal was consumed.

Existing records without quantity/unit metadata are normalized to `1 porción`, so old data remains expandable and editable.

### 2. Cross-domain Shadow advice
The module bridges the gap between Nutrition and Fitness.
- It prioritizes the workout actually saved for the current local day.
- The weekly routine is used only as a planned fallback.
- A biometric reading from the last 48 hours contributes sleep, HRV, steps and readiness.
- Missing macros, training state and recovery are returned as structured signals together with the recommendation.

`NUTRITION_GOALS` is the shared source of truth for the page, dashboard widget and Shadow context.

### 3. Editable daily record
Every confirmed meal supports touch/click expansion, ingredient-level editing, duplication and protected two-step deletion. Water has dedicated 250 ml and 500 ml quick actions.

### 4. Consistency matrix
A selectable 30-day, 90-day or one-year matrix maps nutrition consistency.
- **Columns:** 52 columns tracking the last 365 days.
- **Dynamic Tooltips:** Uses `framer-motion` to render an absolute floating tooltip tracking mouse position, revealing the precise breakdown of Calories, Protein, Carbs, and Fat for any given day on hover.
- **Visual Feedback:** "Perfect" and "Excess" days emit a subtle CSS glow shadow to highlight streaks.

### 5. Obsidian Daily Export (`close_daily_log`)
At the end of the day, the user tells Shadow to "close the day". Shadow fetches all logged data and writes a permanent markdown summary directly into `Diario/YYYY-MM-DD.md` in the user's Obsidian Vault, ensuring long-term health records are kept locally.
