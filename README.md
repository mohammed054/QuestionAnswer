# Quiz Extractor Extension

Chrome extension to extract quiz questions, answers, and OCR text from images on abt-data.com.

## Features

- Extract quiz questions with full Arabic text
- OCR scanning for images containing Arabic and math content
- Detect correct answers (when visually indicated)
- Download as organized ZIP file containing:
  - `quiz.txt` - Human-readable format
  - `quiz.json` - Structured data
  - `images/` - All extracted images
  - `ocr_text.txt` - All OCR results

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the folder: `/home/spikeyz/Desktop/quiz-extension/`
5. Pin the extension to your toolbar

## Usage

1. Navigate to a quiz page: `https://abt-data.com/student/assessment/quiz/*`
2. Click the extension icon
3. Configure options:
   - ✓ Include Images (default: ON)
   - ✓ Enable OCR (default: ON)
   - Format: TXT / JSON
4. Click **استخراج الأسئلة** (Extract Quiz)
5. Wait for extraction to complete
6. ZIP file downloads automatically

## Output Structure

```
quiz_164194_2026-01-21.zip
├── quiz.txt           # Human-readable format
├── quiz.json          # Structured JSON
├── images/
│   ├── q1_img1.png
│   ├── q1_img2.png
│   └── q2_img1.jpg
└── ocr_text.txt       # OCR results
```

## Example TXT Output

```
Quiz ID: 164194
Extracted: 2026-01-21
Questions: 3
═══════════════════════════════════════════════════════════════════

───────────────────────────────────────────────────────────────
س1:
───────────────────────────────────────────────────────────────
[PASSAGE]
قال الله تعالى: ﴿ إِنَّا كُلَّ شَيْءٍ خَلَقْنَاهُ بِقَدَرٍ ﴾

[IMAGE OCR]
س = √(٤ + ٥²)

[QUESTION]
ما معنى كلمة "القدر" في السياق؟

[IMAGES]
- q1_img1.png

[ANSWERS]
1. القسمة (CORRECT)
2. التقدير
3. القدر
```

## OCR Notes

- Uses Tesseract.js (loaded via CDN)
- Supports Arabic text and math symbols
- Best effort for complex math expressions
- Low confidence results are returned as-is (no guessing)

## Troubleshooting

- **"Questions not found"**: Wait for page to fully load, then retry
- **OCR fails**: Check internet connection (CDN required)
- **Images not downloading**: May be blocked by CORS; included in OCR text instead
- **Correct answers not detected**: Extension relies on visual indicators; some layouts may not be detectable

## Files

```
quiz-extension/
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.js           # Popup message handling
├── content.js         # Quiz extraction + OCR
├── background.js      # ZIP generation + download
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── lib/
    └── jszip.min.js   # ZIP library (local)
```
