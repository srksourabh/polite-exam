# Code Style and Conventions

## File Structure
- Single-file SPA architecture in `index.html`
- Inline CSS in `<style>` tags
- Inline JavaScript in `<script>` tags
- Event handlers attached via `addEventListener`

## Naming Conventions
- **Variables**: camelCase (`currentExam`, `userAnswers`)
- **Functions**: camelCase (`submitExam`, `loadQuestion`, `selectOption`)
- **CSS Classes**: kebab-case (`exam-card`, `question-container`)
- **IDs**: kebab-case (`admin-panel`, `candidate-dashboard`)

## CSS Variables
```css
:root {
    --primary: #2c3e50;
    --secondary: #3498db;
    --accent: #e67e22;
    --success: #27ae60;
    --danger: #e74c3c;
    --light: #f8f9fa;
    --dark: #343a40;
}
```

## JavaScript Patterns
- Global variables for state management
- Async/await for API calls
- LocalStorage for session management
- Event-driven architecture
- No framework dependencies (vanilla JS)

## Data Flow
1. User interaction triggers event handler
2. Event handler updates global state
3. State saved to LocalStorage if needed
4. UI updated via DOM manipulation
5. API calls made to Airtable when needed

## Screen Management
- All screens are `.screen` divs
- Active screen has `.active` class
- `updateHeaderNav(screenId)` manages navigation visibility
- State transitions handled by adding/removing active class
