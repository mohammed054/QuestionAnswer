class QuizExtractor {
  constructor() {
    this.questionCounter = 0;
    this.imageCounter = 0;
    this.options = null;
  }
  
  async extract(options) {
    this.options = options;
    
    try {
      chrome.runtime.sendMessage({ status: 'started' });
      
      await this.waitForQuestions();
      
      chrome.runtime.sendMessage({ status: 'finding_questions' });
      
      const questions = await this.extractQuestions();
      
      return {
        status: 'complete',
        data: {
          quizId: this.extractQuizId(),
          extractedAt: new Date().toISOString(),
          questionCount: questions.length,
          questions: questions
        }
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
  
  async waitForQuestions() {
    const maxWait = 15000;
    const checkInterval = 300;
    let waited = 0;
    
    while (waited < maxWait) {
      const questions = document.querySelectorAll('.question.question-card');
      if (questions.length > 0) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    throw new Error('لم يتم العثور على الأسئلة في الصفحة');
  }
  
  async extractQuestions() {
    const questionElements = document.querySelectorAll('.question.question-card');
    
    chrome.runtime.sendMessage({ status: 'questions_found', count: questionElements.length });
    
    const questions = [];
    
    if (this.options.enableOCR) {
      chrome.runtime.sendMessage({ status: 'extracting_images', count: questionElements.length });
    }
    
    for (let i = 0; i < questionElements.length; i++) {
      const element = questionElements[i];
      this.questionCounter++;
      
      const question = {
        number: this.questionCounter,
        passage: '',
        imageOCR: '',
        question: '',
        images: [],
        answers: []
      };
      
      question.passage = this.extractPassage(element);
      question.question = this.extractQuestionText(element);
      
      if (this.options.includeImages || this.options.enableOCR) {
        const imageResults = await this.extractImages(element, i + 1);
        question.images = imageResults.images;
        question.imageOCR = imageResults.ocrText;
      }
      
      question.answers = this.extractAnswers(element);
      
      questions.push(question);
    }
    
    if (this.options.enableOCR && this.imageCounter > 0) {
      chrome.runtime.sendMessage({ status: 'processing_answers' });
    }
    
    return questions;
  }
  
  extractPassage(element) {
    const passageSelectors = [
      '.passage',
      '.reading-passage',
      '[class*="passage"]',
      '.question-passage',
      '.context'
    ];
    
    for (const selector of passageSelectors) {
      const passageEl = element.querySelector(selector);
      if (passageEl && passageEl.textContent.trim().length > 10) {
        return passageEl.textContent.trim();
      }
    }
    
    const parentPassage = element.closest('.passage-container, .reading-section');
    if (parentPassage) {
      const passageText = parentPassage.textContent.trim();
      if (passageText.length > 10) {
        return passageText;
      }
    }
    
    return '';
  }
  
  extractQuestionText(element) {
    const textEl = element.querySelector('.question-content .row .col');
    if (textEl) {
      return textEl.textContent.trim();
    }
    
    const fallbackEl = element.querySelector('.question-text, .question-content, [class*="question-text"]');
    if (fallbackEl) {
      return fallbackEl.textContent.trim();
    }
    
    const directText = element.querySelector('.question-content');
    if (directText) {
      return directText.textContent.trim();
    }
    
    return '';
  }
  
  async extractImages(element, questionNum) {
    const images = [];
    let ocrText = '';
    const imageElements = element.querySelectorAll('.question-content img, .passage img, [class*="question"] img');
    
    for (let i = 0; i < imageElements.length; i++) {
      const img = imageElements[i];
      
      if (!img.src || img.src.startsWith('data:') || img.src.length < 10) continue;
      
      this.imageCounter++;
      const imgName = `q${questionNum}_img${i + 1}`;
      const ext = this.getImageExtension(img.src);
      const filename = `${imgName}.${ext}`;
      
      images.push({ filename, src: img.src });
      
      if (this.options.enableOCR) {
        try {
          const imgData = await this.imageToDataURL(img);
          const result = await this.runOCR(imgData, questionNum, i + 1, imageElements.length);
          if (result && result.text) {
            ocrText += (ocrText ? '\n\n' : '') + `[${filename}]\n${result.text}`;
          }
        } catch (err) {
          console.error(`OCR failed for image ${filename}:`, err);
        }
      }
    }
    
    return { images, ocrText };
  }
  
  async imageToDataURL(imgElement) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = imgElement.naturalWidth;
      let height = imgElement.naturalHeight;
      
      const maxSize = 2000;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const processed = this.preprocessImage(imageData);
        ctx.putImageData(processed, 0, 0);
        
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imgElement.src;
    });
  }
  
  preprocessImage(imageData) {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
    
    const intercept = 128 * (1 - 1.5);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * 1.5 + intercept));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * 1.5 + intercept));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * 1.5 + intercept));
    }
    
    return imageData;
  }
  
  async runOCR(imageData, questionNum, imageNum, totalImages) {
    if (typeof Tesseract === 'undefined') {
      await this.loadTesseract();
    }
    
    chrome.runtime.sendMessage({
      status: 'ocr_progress',
      current: imageNum,
      total: totalImages,
      percent: ((imageNum - 1) / totalImages) * 100
    });
    
    try {
      const worker = await Tesseract.createWorker('ara+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress > 0) {
          }
        }
      });
      
      const { data: { text, confidence } } = await worker.recognize(imageData, {
        tessedit_pageseg_mode: Tesseract.PSM.AUTO
      });
      
      await worker.terminate();
      
      let cleanedText = text.trim();
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
      cleanedText = cleanedText.replace(/[ \t]+/g, ' ');
      
      return { text: cleanedText, confidence };
    } catch (error) {
      console.error(`OCR error for q${questionNum}_img${imageNum}:`, error);
      return { text: '', confidence: 0 };
    }
  }
  
  async loadTesseract() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
      document.head.appendChild(script);
    });
  }
  
  extractAnswers(element) {
    const answers = [];
    const answerElements = element.querySelectorAll('.form-check-label, .answer-option, [class*="answer"] label');
    
    answerElements.forEach((answerEl, index) => {
      const text = answerEl.textContent.trim();
      if (text.length > 0) {
        answers.push({
          text: text,
          correct: this.isCorrectAnswer(answerEl)
        });
      }
    });
    
    if (answers.length === 0) {
      const radioButtons = element.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      radioButtons.forEach((radio, index) => {
        const label = radio.closest('.form-check, .form-group, div[class*="answer"]');
        if (label) {
          const text = label.textContent.replace(radio.value, '').trim();
          if (text) {
            answers.push({
              text: text,
              correct: this.isCorrectAnswer(label)
            });
          }
        }
      });
    }
    
    return answers;
  }
  
  isCorrectAnswer(element) {
    const parent = element.closest('.form-check, .form-check-label, div[class*="answer"], label[class*="answer"]');
    if (parent) {
      const classList = parent.className.toLowerCase();
      if (classList.includes('correct') || 
          classList.includes('success') || 
          classList.includes('is-correct') ||
          classList.includes('right-answer')) {
        return true;
      }
    }
    
    const input = element.querySelector?.('input[type="radio"], input[type="checkbox"]');
    if (input && input.checked && input.disabled) {
      return true;
    }
    
    const inlineClasses = element.className.toLowerCase();
    if (inlineClasses.includes('correct') || 
        inlineClasses.includes('success') ||
        inlineClasses.includes('is-correct')) {
      return true;
    }
    
    const style = window.getComputedStyle(element);
    if (style.backgroundColor && this.isGreenColor(style.backgroundColor)) {
      return true;
    }
    
    const correctIcon = element.querySelector?.('.correct-icon, .check-icon, [class*="correct"]');
    if (correctIcon) {
      return true;
    }
    
    return false;
  }
  
  isGreenColor(color) {
    if (!color || color === 'transparent') return false;
    
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return g > r && g > b && g > 100;
    }
    
    const hexMatch = color.match(/#([0-9a-fA-F]{6})/);
    if (hexMatch) {
      const r = parseInt(hexMatch[1].substring(0, 2), 16);
      const g = parseInt(hexMatch[1].substring(2, 4), 16);
      const b = parseInt(hexMatch[1].substring(4, 6), 16);
      return g > r && g > b && g > 100;
    }
    
    return false;
  }
  
  extractQuizId() {
    const url = window.location.href;
    const match = url.match(/quiz\/(\d+)/);
    return match ? match[1] : 'unknown';
  }
  
  getImageExtension(src) {
    const match = src.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
    if (match) return match[1].toLowerCase();
    return 'png';
  }
}

let extractor = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract') {
    (async () => {
      if (!extractor) {
        extractor = new QuizExtractor();
      }
      const result = await extractor.extract(message.options);
      sendResponse(result);
    })();
    return true;
  }
});
