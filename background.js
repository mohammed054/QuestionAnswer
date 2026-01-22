// Load JSZip library dynamically
let JSZip;
(async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('lib/jszip.min.js'));
    const text = await response.text();
    // Execute in global scope
    const func = new Function(text + '; return JSZip;');
    JSZip = func();
    console.log('JSZip loaded:', typeof JSZip);
  } catch (e) {
    console.error('Failed to load JSZip:', e);
  }
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    (async () => {
      try {
        if (typeof JSZip === 'undefined') {
          throw new Error('JSZip not loaded yet');
        }
        console.log('Starting download process...');
        console.log('Quiz data:', message.data.quizId, message.data.questionCount);
        console.log('Options:', message.options);
        
        const result = await createAndDownloadZip(message.data, message.options);
        console.log('Download result:', result);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Download error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

chrome.downloads.onChanged.addListener((downloadDelta) => {
  console.log('Download changed:', downloadDelta);
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('Download created:', downloadItem);
});

async function createAndDownloadZip(data, options) {
  console.log('Starting download for quiz:', data.quizId);
  const zip = new JSZip();
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFolder = `quiz_${data.quizId}_${timestamp}`;
  const root = zip.folder(baseFolder);
  const imagesFolder = root.folder('images');
  const ocrTexts = [];
  
  let txtContent = `Quiz ID: ${data.quizId}\n`;
  txtContent += `Extracted: ${data.extractedAt}\n`;
  txtContent += `Questions: ${data.questionCount}\n`;
  txtContent += '═'.repeat(60) + '\n\n';
  
  for (const q of data.questions) {
    txtContent += `${'─'.repeat(60)}\n`;
    txtContent += `س${q.number}:\n`;
    txtContent += `${'─'.repeat(60)}\n`;
    
    if (q.passage) {
      txtContent += '[PASSAGE]\n' + q.passage + '\n\n';
    }
    
    if (q.imageOCR) {
      txtContent += '[IMAGE OCR]\n' + q.imageOCR + '\n\n';
      ocrTexts.push(`س${q.number} - OCR:\n${q.imageOCR}`);
    }
    
    txtContent += '[QUESTION]\n' + q.question + '\n\n';
    
    if (q.images.length > 0) {
      txtContent += '[IMAGES]\n';
      q.images.forEach(img => {
        txtContent += `- ${img.filename}\n`;
      });
      txtContent += '\n';
    }
    
    txtContent += '[ANSWERS]\n';
    q.answers.forEach((a, i) => {
      const correctMark = a.correct ? ' (CORRECT)' : '';
      txtContent += `${i + 1}. ${a.text}${correctMark}\n`;
    });
    
    txtContent += '\n';
  }
  
  root.file('quiz.txt', txtContent);
  
  const exportData = {
    quizId: data.quizId,
    extractedAt: data.extractedAt,
    questionCount: data.questionCount,
    questions: data.questions.map(q => ({
      number: q.number,
      passage: q.passage || null,
      imageOCR: q.imageOCR || null,
      question: q.question,
      images: options.includeImages ? q.images.map(i => i.filename) : [],
      answers: q.answers.map(a => ({
        text: a.text,
        correct: a.correct
      }))
    }))
  };
  
  root.file('quiz.json', JSON.stringify(exportData, null, 2));
  
  if (ocrTexts.length > 0) {
    root.file('ocr_text.txt', ocrTexts.join('\n\n' + '═'.repeat(40) + '\n\n'));
  }
  
  if (options.includeImages) {
    for (const q of data.questions) {
      for (const img of q.images) {
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          imagesFolder.file(img.filename, arrayBuffer);
        } catch (error) {
          console.error(`Failed to fetch image ${img.filename}:`, error);
        }
      }
    }
  }
  
  const content = await zip.generateAsync({ type: 'blob' });
  console.log('ZIP created, size:', content.size);
  console.log('Creating blob URL...');
  
  const url = URL.createObjectURL(content);
  console.log('Blob URL created:', url.substring(0, 50) + '...');
  
  const filename = `${baseFolder}.zip`;
  console.log('Attempting to download:', filename);
  
  const downloadId = await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  });
  
  console.log('Download initiated with ID:', downloadId);
  
  // Clean up URL after delay
  setTimeout(() => {
    console.log('Revoking URL...');
    URL.revokeObjectURL(url);
  }, 5000);
  
  return { downloadId, filename, size: content.size };
}
