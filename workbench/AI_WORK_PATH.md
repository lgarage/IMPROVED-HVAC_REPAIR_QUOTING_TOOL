# AI Work Path

> Generated: 2026-05-14 14:49:06
> Parser confidence: 70%

## Project Snapshot

- **Project:** workbench
- **Type:** Web App (Backend)
- **Framework:** Express
- **Package manager:** npm
- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `(not detected)`

## User Goal

- when the ai task is running the log viewer is really small on mobile i can barely read it, needs to be taller maybe 60% of screen height

## Parsed Work Items

### Bugs
- [ ] the folder browser is slow when you tap a folder theres no loading indicator so it just feels broken

### UI / Layout Changes
- [ ] when the ai task is running the log viewer is really small on mobile i can barely read it, needs to be taller maybe 60% of screen height
- [ ] also would be nice to have a copy button on the logs so i can paste them somewhere

### Business Logic Changes
- [ ] the folder browser is slow when you tap a folder theres no loading indicator so it just feels broken
- [ ] when the ai task is running the log viewer is really small on mobile i can barely read it, needs to be taller maybe 60% of screen height

### Config / Documentation / Other
- [ ] also the breadcrumb segments are too close together on phone hard to tap the right one
- [ ] one more thing - if i restart the server everything is wiped
- [ ] it would be nice if it remembered the last repo i had open at least so i dont have to re-pick it every time

## Likely Files To Inspect


## Guardrails

- Preserve existing functionality
- Avoid unrelated edits
- Ask before risky changes
- Do not auto-deploy
- Do not auto-commit

## Verification Plan

- [ ] Run build: `npm run build`
- [ ] Start app: `npm run dev`
- [ ] Check browser console for errors

## Confidence Reporting

After AI work completes, report:
- Files changed
- Tests run and results
- Console errors found
- Screenshots captured (if applicable)
- Confidence score (0-100%)
- Escalation reasoning (if confidence < 80%)
