# Positional Tracker

BUILD: POSITIONAL TRANSITION ANALYZER

Build a production-quality web application called Positional Transition Analyzer.

The application analyzes historical lottery/game draws to identify repeated positional transitions from one draw to the immediately following draw.

CORE PURPOSE — THIS IS THE MOST IMPORTANT REQUIREMENT

The application is NOT primarily looking for the original numbers to repeat in the next game.

The central question is:

When a particular number appears in a particular position in a historical draw, what number subsequently appears in each position of the immediately following draw, and does that exact source-position → target-position → target-number relationship occur repeatedly?

Example:

Historical draw:

P1 = 34
P2 = 90
P3 = 28
P4 = 86
P5 = 11
P6 = 30
P7 = 72
P8 = 78
P9 = 75
P10 = 80


Immediately following draw:

P1 = 31
P2 = 66
P3 = 41
P4 = 32
P5 = 88
P6 = 09
P7 = 06
P8 = 85
P9 = 57
P10 = 70


This produces relationships including:

P1:34 → P1:31
P1:34 → P2:66
P1:34 → P3:41
...
P1:34 → P10:70


and:

P7:72 → P1:31
P7:72 → P2:66
...
P7:72 → P10:70


If historical analysis finds:

P1:34 → P2:66


three separate times, the primary result is:

P1:34 → P2:66
3 historical occurrences


If it also finds:

P7:72 → P2:66
2 historical occurrences


the application should identify this as positional convergence:

P1:34 ──┐
        ├──→ P2:66
P7:72 ──┘


This is the core functionality.

1. TECHNOLOGY

Use:

React

TypeScript

Vite

Tailwind CSS

Supabase

modern component architecture

responsive design

clean reusable components

proper database persistence

robust parsing and validation

Do not create a static mockup.

Build a fully functional application.

2. APPLICATION STRUCTURE

Create the following main navigation:

Dashboard
New Analysis
Historical Data
Saved Analyses
Settings


The primary workflow should be:

1. Enter Current Game
        ↓
2. Paste Historical Games
        ↓
3. Run Analysis
        ↓
4. Examine Repeated Positional Transitions


3. CURRENT GAME INPUT

Create a New Analysis page.

Required fields:

Game Name

Example:

Better Chance


Provider

Example:

Golden Chance Vision


Date Played

Date picker.

Current 10 Numbers

Display ten clearly labelled inputs:

P1 [  ]
P2 [  ]
P3 [  ]
P4 [  ]
P5 [  ]

P6 [  ]
P7 [  ]
P8 [  ]
P9 [  ]
P10 [  ]


Visually display the sequence as:

P1 P2 P3 P4 P5 | P6 P7 P8 P9 P10


Accept numbers from:

01–90


Normalize:

4 → 04
8 → 08
34 → 34
90 → 90


Require exactly 10 numbers.

Do not sort the numbers.

Position must always be preserved.

4. HISTORICAL DATA INPUT

Provide a large textarea titled:

Paste Historical Games

The user should be able to paste data such as:

0081: 04/08/2021: 38 59 13 71 56 | 01 86 30 37 65
0082: 11/08/2021: 65 50 28 87 58 | 30 80 64 22 76
0083: 18/08/2021: 82 37 53 77 08 | 74 02 22 36 19

0086: 08/09/2021: 50 76 40 35 10 | 18 09 27 23 45
0087: 15/09/2021: 34 53 87 73 05 | 25 72 37 30 55
0088: 22/09/2021: 31 84 41 32 88 | 09 06 85 57 70


Also support reasonable variations such as:

81 - 04/08/2021 - 38 59 13 71 56 | 01 86 30 37 65


Ignore headers and irrelevant text.

For example:

Golden Chance Vision
Began 22/01/2020
Last updated 16/09/2026
[End Golden Chance Vision]


must not break parsing.

5. IMPORT PREVIEW

Before analysis, parse the pasted data and display:

147 games detected

Valid:
143

Invalid:
4


For invalid rows show:

Line 17
Expected 10 numbers but found 9.


Allow the user to remove invalid records or correct them.

Never silently discard malformed records.

6. HISTORICAL DRAW DATA STRUCTURE

Every historical draw must be represented as:

drawNumber
drawDate

P1
P2
P3
P4
P5

P6
P7
P8
P9
P10


Position is immutable.

For example:

34 90 28 86 11 | 30 72 78 75 80


must always mean:

P1 = 34
P2 = 90
P3 = 28
P4 = 86
P5 = 11
P6 = 30
P7 = 72
P8 = 78
P9 = 75
P10 = 80


7. CHRONOLOGICAL RULE

Historical draws must be ordered chronologically.

Use:

draw date

draw number as a secondary ordering mechanism

For every historical draw:

Historical Draw N
        ↓
Immediately Following Draw N+1


Never use the same draw as its own next draw.

If there is no following historical draw, that historical occurrence cannot be used for transition analysis.

8. THE CORE ANALYSIS ENGINE

This is the authoritative analytical algorithm.

For each of the 10 numbers entered by the user:

sourcePosition
sourceNumber


search the historical database for draws where:

historicalDraw[sourcePosition] === sourceNumber


Example current input:

34 90 28 86 11 | 30 72 78 75 80


creates these ten source observations:

P1:34
P2:90
P3:28
P4:86
P5:11
P6:30
P7:72
P8:78
P9:75
P10:80


For every historical occurrence of each source observation, inspect the immediately following draw.

Then compare the source observation against EVERY position in the next draw.

For each target position create:

sourcePosition
sourceNumber
targetPosition
targetNumber


Example:

P1:34 → P1:31
P1:34 → P2:66
P1:34 → P3:41
...
P1:34 → P10:70


Do the same for every source observation.

9. EXACT PSEUDOCODE

Implement the logic equivalent to:

const currentPositions = [
  { position: 1, number: current.p1 },
  { position: 2, number: current.p2 },
  { position: 3, number: current.p3 },
  { position: 4, number: current.p4 },
  { position: 5, number: current.p5 },
  { position: 6, number: current.p6 },
  { position: 7, number: current.p7 },
  { position: 8, number: current.p8 },
  { position: 9, number: current.p9 },
  { position: 10, number: current.p10 }
];

for (const source of currentPositions) {

  const historicalMatches = historicalDraws.filter(
    draw => draw[`p${source.position}`] === source.number
  );

  for (const historicalDraw of historicalMatches) {

    const nextDraw = getImmediatelyFollowingDraw(historicalDraw);

    if (!nextDraw) continue;

    for (let targetPosition = 1; targetPosition <= 10; targetPosition++) {

      const targetNumber = nextDraw[`p${targetPosition}`];

      recordTransition({
        sourcePosition: source.position,
        sourceNumber: source.number,
        targetPosition,
        targetNumber,
        historicalDrawId: historicalDraw.id,
        nextDrawId: nextDraw.id
      });
    }
  }
}


Then group transitions by:

sourcePosition
sourceNumber
targetPosition
targetNumber


and calculate:

occurrenceCount


10. PRIMARY RESULT

The primary results page must show repeated transitions.

Default filter:

Minimum occurrences: 2


Example:

SourceTargetHistorical OccurrencesP1:34P2:663P3:28P5:443P7:72P2:662P1:34P4:722

The most important visual element is:

P1:34  →  P2:66  ×3


The user should immediately understand:

Number 34 occurring in Position 1 historically preceded number 66 appearing in Position 2 three times.

11. DO NOT REQUIRE THE TARGET NUMBER TO BE ONE OF THE CURRENT NUMBERS

This is extremely important.

Suppose the current input contains:

34
90
28
86
11
30
72
78
75
80


and historical analysis finds:

P1:34 → P2:66


66 must be included even though 66 was NOT in the current 10-number input.

The target number can be any valid number from:

01–90


The analysis is about transitions, not repetition of the original numbers.

12. DO NOT MAKE NUMBER REAPPEARANCE THE PRIMARY FEATURE

Do NOT make the main analysis:

Did 34 appear again?
Did 90 appear again?
Did 28 appear again?


That is not the purpose of this application.

The primary analysis is:

SOURCE POSITION + SOURCE NUMBER
                ↓
       NEXT POSITION
                ↓
       NEXT NUMBER


Example:

P1:34 → P2:66


is a valid and important result even if 34 never appears in the next draw.

13. REPEATED TRANSITION FILTER

Provide:

Minimum historical occurrences
[ 2 ▼ ]


Options:

1
2
3
4
5
10


Default:

2


When set to 2, only transitions observed at least twice are shown in the primary results.

The user may choose 1 to inspect all historical transitions.

14. SOURCE ANALYSIS

Create a section called:

Source Position Analysis

Display each current number separately.

Example:

P1:34

Historical occurrences:
17


Then:

Next PositionNext NumberOccurrencesP2663P4722P7182

The user should immediately see:

P1:34 → P2:66 ×3


15. ALL 10 SOURCE NUMBERS

Create ten source cards:

P1:34
P2:90
P3:28
P4:86
P5:11
P6:30
P7:72
P8:78
P9:75
P10:80


Each card shows the repeated transitions originating from that source.

Example:

P1:34

P2:66 ×3
P4:72 ×2
P7:18 ×2


Another:

P7:72

P2:66 ×2
P9:31 ×2


16. POSITIONAL CONVERGENCE

This is an important secondary analysis.

Find cases where multiple current source observations lead to the SAME target position and target number.

Example:

P1:34 → P2:66 ×3
P7:72 → P2:66 ×2
P3:28 → P2:66 ×2


Display:

             P1:34
                │
                │
P3:28 ──────────┼──→ P2:66
                │
                │
             P7:72


And clearly state:

Target: P2:66

Historical source relationships:

P1:34 → P2:66
3 occurrences

P3:28 → P2:66
2 occurrences

P7:72 → P2:66
2 occurrences


Call this:

Positional Convergence

Do not call it a guaranteed prediction.

17. TARGET-CENTRIC VIEW

Provide a second way to view the data:

Target Analysis

Instead of:

What follows P1:34?


allow:

What source patterns have historically led to P2:66?


Example:

Target: P2:66

P1:34 → P2:66 ×3
P7:72 → P2:66 ×2
P3:28 → P2:66 ×2


This makes convergence extremely easy to discover.

18. POSITIONAL TRANSITION MATRIX

Create a visual matrix showing transition counts between positions.

Example:

Source → TargetP1P2P3P4P5P6P7P8P9P10P11302002000P20100200100P30201300010...

This matrix should represent the number of repeated source-position → target-position relationships.

Allow clicking a cell to drill into the exact number relationships.

For example clicking:

P1 → P2


shows:

P1:34 → P2:66 ×3
P1:34 → P2:71 ×2
P1:28 → P2:44 ×2


19. HISTORICAL EVIDENCE

Every result must be traceable back to the actual historical draws.

If the application reports:

P1:34 → P2:66 ×3


the user must be able to expand it and see all three occurrences.

Example:

Occurrence #1

Historical draw:

0087
15/09/2021

34 53 87 73 05 | 25 72 37 30 55


Source:

P1 = 34


Immediately following draw:

0088
22/09/2021

31 66 41 32 88 | 09 06 85 57 70


Target:

P2 = 66


Display:

P1:34 → P2:66


Repeat this evidence for every occurrence.

20. DRAW-TO-DRAW VIEW

Each transition should also have an expandable visual:

HISTORICAL DRAW

P1  34
P2  53
P3  87
P4  73
P5  05
|
P6  25
P7  72
P8  37
P9  30
P10 55

             ↓ NEXT DRAW

P1  31
P2  66  ← TARGET
P3  41
P4  32
P5  88
|
P6  09
P7  06
P8  85
P9  57
P10 70


Clearly highlight:

SOURCE: P1:34
TARGET: P2:66


21. CURRENT INPUT SUMMARY

At the top of results show:

GAME
Better Chance

PROVIDER
Golden Chance Vision

DATE
20/09/2026

CURRENT NUMBERS

34 90 28 86 11 | 30 72 78 75 80


Then:

Historical draws analyzed: 147
Source observations analyzed: 10
Repeated transitions found: 23
Positional convergence targets: 5


These values must be calculated dynamically.

22. IMPORTANT: SOURCE OCCURRENCE COUNT

For each source observation show how many times it occurred historically.

Example:

P1:34

Historical occurrences:
17

Occurrences with a valid next draw:
16


This is important because the user needs to know the size of the historical sample behind each transition.

23. HISTORICAL FREQUENCY

For each transition display:

P1:34 → P2:66

Occurrences:
3

Source occurrences with next draws:
16


Optionally calculate:

Historical occurrence rate:
18.75%


Label this clearly as:

Historical occurrence rate

Do NOT call it a guaranteed future probability.

Do not imply that historical frequency guarantees future outcomes.

24. SEARCH / FILTERS

Allow filtering by:

Minimum transition occurrences

2+
3+
4+
5+
10+


Source positions

All
P1
P2
...
P10


Target positions

All
P1
P2
...
P10


Date range

From
To


Minimum source observations

Optional.

25. SORTING

Allow sorting results by:

Occurrence count
Source position
Target position
Source number
Target number
Date


Default:

Occurrence count descending


26. SAVED ANALYSES

Save every analysis session.

Store:

Game name
Provider
Analysis date
Current 10 numbers
Historical dataset
Minimum occurrence filter
Results
Created timestamp


Allow users to reopen an analysis.

27. SUPABASE DATABASE

Create appropriate tables.

games

id
game_name
provider
created_at


historical_draws

id
game_id
draw_number
draw_date

p1
p2
p3
p4
p5
p6
p7
p8
p9
p10

created_at


analysis_sessions

id
game_name
provider
played_date

current_p1
current_p2
current_p3
current_p4
current_p5
current_p6
current_p7
current_p8
current_p9
current_p10

minimum_occurrences

created_at


transitions

id
analysis_session_id

historical_draw_id
next_draw_id

source_position
source_number

target_position
target_number

created_at


Add appropriate indexes, especially on:

game_id
draw_date
draw_number

source_position
source_number

target_position
target_number


Create unique constraints where appropriate to prevent accidental duplicate historical draws.

28. TRANSITION AGGREGATION

Do not permanently store only aggregated results.

Keep the individual transition evidence.

Then dynamically aggregate:

sourcePosition
sourceNumber
targetPosition
targetNumber


to calculate:

occurrenceCount


This allows every displayed result to be traced back to the original historical draws.

29. DUPLICATE HISTORICAL DATA

Detect duplicate historical draws using an appropriate combination such as:

game
draw number
date
10 numbers


Warn the user.

Do not double-count duplicate historical records.

30. SAMPLE TEST DATA

Use this data to test the parser and chronological engine:

0081: 04/08/2021: 38 59 13 71 56 | 01 86 30 37 65
0082: 11/08/2021: 65 50 28 87 58 | 30 80 64 22 76
0083: 18/08/2021: 82 37 53 77 08 | 74 02 22 36 19

0086: 08/09/2021: 50 76 40 35 10 | 18 09 27 23 45
0087: 15/09/2021: 34 53 87 73 05 | 25 72 37 30 55
0088: 22/09/2021: 31 84 41 32 88 | 09 06 85 57 70

0234: 10/07/2024: 73 83 25 57 80 | 38 19 23 46 54
0235: 17/07/2024: 25 14 01 86 28 | 20 07 78 54 02
0236: 24/07/2024: 09 42 74 90 88 | 04 23 17 78 11

0262: 22/01/2025: 61 47 64 62 63 | 79 15 87 22 09
0263: 29/01/2025: 22 60 08 41 42 | 30 19 78 38 35
0264: 05/02/2025: 60 28 57 05 49 | 53 75 85 61 70

0283: 18/06/2025: 83 45 49 64 13 | 71 16 84 57 15
0284: 25/06/2025: 86 43 28 01 53 | 82 72 07 51 83
0285: 02/07/2025: 08 35 46 76 86 | 06 75 48 05 45


Test current input:

34 90 28 86 11 | 30 72 78 75 80


31. CRITICAL TEST CASE

The implementation must be capable of detecting an intentionally repeated relationship such as:

Historical Draw A
P1 = 34

Next Draw A
P2 = 66


and:

Historical Draw B
P1 = 34

Next Draw B
P2 = 66


The result must be:

P1:34 → P2:66
2 occurrences


If a third historical occurrence exists:

P1:34 → P2:66
3 occurrences


Do not accidentally interpret this as:

34 repeated


The relationship is specifically:

SOURCE POSITION = P1
SOURCE NUMBER = 34

TARGET POSITION = P2
TARGET NUMBER = 66


32. CONVERGENCE TEST

Also verify that the system can detect:

P1:34 → P2:66 ×3
P7:72 → P2:66 ×2


and classify this as:

Positional Convergence

with target:

P2:66


The system should clearly show that two different source-position/number combinations independently have historical transitions toward the same target.

33. VISUAL DESIGN

Create a sophisticated analytical dashboard.

Style:

dark professional interface

clean typography

high contrast

subtle borders

responsive

desktop-first but mobile-compatible

data tables

expandable cards

heatmaps

transition diagrams

clear source/target highlighting

Do not make the application look like a casino.

It should look like a quantitative historical pattern-analysis platform.

34. PRIMARY DASHBOARD LAYOUT

Use this hierarchy:

┌──────────────────────────────────────────────┐
│ POSITIONAL TRANSITION ANALYZER               │
│ Historical source → target relationships     │
└──────────────────────────────────────────────┘

CURRENT GAME
34 90 28 86 11 | 30 72 78 75 80

───────────────────────────────────────────────

REPEATED TRANSITIONS

P1:34 → P2:66                 ×3
P3:28 → P5:44                 ×3
P7:72 → P2:66                 ×2
P1:34 → P4:72                 ×2

───────────────────────────────────────────────

POSITIONAL CONVERGENCE

                    P1:34
                       │
                       ├────→ P2:66
                       │
                    P7:72

───────────────────────────────────────────────

SOURCE ANALYSIS

P1:34
  P2:66 ×3
  P4:72 ×2

P2:90
  ...

P3:28
  P5:44 ×3

───────────────────────────────────────────────

POSITION TRANSITION MATRIX

          TARGET POSITION
SOURCE
POSITION   P1 P2 P3 P4 P5 P6 P7 P8 P9 P10

───────────────────────────────────────────────

HISTORICAL EVIDENCE

P1:34 → P2:66

Occurrence #1
...

Occurrence #2
...

Occurrence #3
...


35. LANGUAGE RULES

Use neutral analytical terminology:

GOOD:

Historical occurrence
Repeated transition
Source position
Target position
Historical frequency
Positional convergence
Observed relationship
Historical occurrence rate


Do NOT use:

Guaranteed
Sure
Certain
Winning number
Guaranteed prediction
Fixed result


The application analyzes historical relationships and must not represent historical frequency as certainty about future results.

36. PERFORMANCE

The application should efficiently handle large historical datasets.

Design the data queries and indexes so that thousands of historical draws can be analyzed without freezing the UI.

For larger datasets, perform aggregation efficiently on the backend where appropriate.

Use pagination for detailed historical evidence.

37. FINAL ACCEPTANCE CRITERIA

The application is complete only when all of the following work:

Input

Game name

Provider

Date

10 ordered numbers

Historical import

Paste historical games

Parse dates

Parse draw numbers

Parse exactly 10 numbers

Preserve positions

Validate errors

Detect duplicates

Analysis

The system must:

Take each current position + number.

Find historical occurrences at that exact position.

Locate the immediately following historical draw.

Inspect all 10 positions in that next draw.

Create source → target relationships.

Aggregate identical relationships.

Show relationships occurring 2+ times.

Show the exact source position and number.

Show the exact target position and number.

Show the number of historical occurrences.

Allow drilling into the underlying historical draws.

Detect positional convergence where multiple source observations lead to the same target position/number.

MOST IMPORTANT ACCEPTANCE TEST

If history contains:

P1:34
   ↓
P2:66

P1:34
   ↓
P2:66

P1:34
   ↓
P2:66


the application MUST display:

P1:34 → P2:66
3 historical occurrences


If history also contains:

P7:72
   ↓
P2:66

P7:72
   ↓
P2:66


the application MUST display:

POSITIONAL CONVERGENCE

P1:34 → P2:66 ×3
P7:72 → P2:66 ×2


The application must NOT reduce this to:

66 appeared 5 times


because that loses the positional information.

The positional relationship is the entire point of the application.

FINAL INSTRUCTION TO LOVABLE

Build the application around this exact analytical model:

CURRENT
POSITION + NUMBER
        ↓
HISTORICAL MATCH
        ↓
IMMEDIATELY NEXT DRAW
        ↓
TARGET POSITION + TARGET NUMBER
        ↓
REPEATED HISTORICAL TRANSITION
        ↓
POSITIONAL CONVERGENCE


Do not substitute generic number-frequency analysis for this model.

Do not make original-number reappearance the primary analysis.

The application's most valuable result should always be something that can be expressed as:

P1:34 → P2:66 ×3


with the underlying historical evidence available for verification.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://positionfinder.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e77d6ed8-68a9-49ee-bc9a-13997718b1b1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
