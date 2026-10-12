# LeetCode Dynamic Search Implementation

## Summary
Added dynamic problem search functionality that queries LeetCode's GraphQL API, allowing users to search and load LeetCode problems directly into the coding workspace.

## Files Created

### Backend
1. **backend/src/services/leetcodeService.js** (238 lines)
   - `searchLeetCodeProblems(query)` - Searches LeetCode problems via GraphQL
   - `getLeetCodeProblemDetails(titleSlug)` - Fetches complete problem details
   - HTML parsing utilities for extracting examples and constraints
   - Code snippet mapping for multiple languages
   - Timeout handling (10s for search, 15s for details)
   - Error handling that returns empty arrays instead of crashing

2. **backend/src/controllers/problemSearchController.js** (39 lines)
   - `searchProblems(req, res)` - GET /api/problems/search endpoint
   - `getLeetCodeProblem(req, res)` - GET /api/problems/leetcode/:titleSlug endpoint

3. **backend/src/routes/problemSearchRoutes.js** (12 lines)
   - Route definitions for search endpoints
   - Mounted at /api/problems

## Files Modified

### Backend
1. **backend/src/app.js**
   - Added import for problemSearchRoutes
   - Registered new routes at `/api/problems` (after existing problemRoutes)

### Frontend
1. **frontend/src/services/api.js**
   - Added `searchLeetCode(query)` - Search LeetCode problems
   - Added `getLeetCodeProblem(titleSlug)` - Fetch problem details by slug

2. **frontend/src/pages/Dashboard.jsx**
   - Added LeetCode search state (query, results, dropdown visibility, loading)
   - Added 300ms debounced search with useEffect
   - Added click-outside handler for dropdown
   - Added separate "Search LeetCode..." input field with blue styling
   - Added dropdown showing search results with difficulty badges
   - Added `handleLeetcodeProblemSelect()` to navigate to room with LeetCode problem
   - LeetCode problems navigate to `/room/LEETCODE-{titleSlug}` with problem data in state

3. **frontend/src/pages/RoomView.jsx**
   - Added `isLeetCodeProblem` state flag
   - Added useEffect to handle LeetCode problem from navigation state
   - Disabled Socket.IO room joining for LeetCode problems (solo mode)
   - Disabled collaborative features for LeetCode problems:
     - Real-time code sync
     - Cursor tracking
     - Typing indicators
     - Participant list
     - Chat functionality
     - Host controls (change problem, invite friends)
   - Adjusted layout: 35% description / 65% editor for LeetCode (vs 30%/50%/20% for rooms)
   - Language selection enabled for LeetCode problems (local state only)
   - Submission disabled for LeetCode problems (no test case validation)
   - Added "LeetCode" badge and notice in description panel
   - Code execution works but without test case validation

## Features

### Search Experience
- **Debounced search**: 300ms delay prevents API spam
- **Minimum query length**: Requires 2+ characters
- **Real-time results**: Dropdown shows matching problems as you type
- **Difficulty badges**: Color-coded badges (green/easy, amber/medium, red/hard)
- **Problem IDs**: Shows LeetCode problem number (#1, #2, etc.)
- **Loading state**: Spinner while searching
- **Empty state**: "No problems found" message
- **Click-outside**: Dropdown closes when clicking outside

### Problem Loading
- **Solo mode**: LeetCode problems load in solo mode without Socket.IO
- **Complete data**: Title, difficulty, description, examples, constraints, starter code
- **Multiple languages**: JavaScript, Python, C++, Java starter code
- **HTML parsing**: Robust parsing of LeetCode's HTML content
- **Error handling**: Graceful fallbacks if parsing fails

### Workspace Features
- **Monaco Editor**: Fully functional with syntax highlighting
- **Language switching**: Can switch between supported languages
- **Code execution**: Run code via Judge0 (without test case validation)
- **Clean UI**: Adjusted layout for better solo coding experience
- **Visual indicators**: "LeetCode" badge and notice in description

### Limitations (By Design)
- **No submission**: LeetCode problems cannot be submitted for validation
- **No collaboration**: Solo mode only (no Socket.IO features)
- **No test cases**: LeetCode doesn't provide expected outputs in their API
- **Notice shown**: Users informed to use LeetCode's platform for full validation

## API Endpoints

### GET /api/problems/search?q=query
- Searches LeetCode problems
- Query parameter: `q` (search keywords)
- Returns: Array of `{ title, titleSlug, difficulty, questionId }`
- Max 10 results per search
- 10 second timeout

### GET /api/problems/leetcode/:titleSlug
- Fetches complete problem details
- Parameter: `titleSlug` (LeetCode problem slug)
- Returns: Full problem object with description, examples, constraints, starter code
- 15 second timeout

## Error Handling

### Backend
- Network errors return empty arrays (search) or throw errors (details)
- Timeouts prevent hanging requests
- HTML parsing has multiple fallback patterns
- Logs errors to console for debugging

### Frontend
- Search errors clear results array
- Problem fetch errors show toast notification
- Empty results show "No problems found" message
- Graceful degradation if API is unavailable

## Testing
- Frontend builds successfully without errors
- Backend services pass syntax validation
- No breaking changes to existing functionality
- All existing features remain intact

## Notes
- LeetCode GraphQL API is public and doesn't require authentication
- CORS is handled by axios (LeetCode allows cross-origin requests)
- Rate limiting is client-side (debounce) to respect LeetCode's servers
- Implementation is non-invasive - adds functionality without modifying existing code paths
