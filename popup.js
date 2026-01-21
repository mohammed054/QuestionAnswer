document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const includeImagesCheckbox = document.getElementById('includeImages');
  const enableOCRLabel = document.querySelector('label[for="enableOCR"]');
  const enableOCRCheckbox = document.getElementById('enableOCR');
  const formatRadios = document.querySelectorAll('input[name="format"]');
  const progressContainer = document.getElementById('progressContainer');
  const progressLabel = document.getElementById('progressLabel');
  const progressBar = document.getElementById('progressBar');
  const statusEl = document.getElementById('status');
  
  let isExtracting = false;
  
  extractBtn.addEventListener('click', startExtraction);
  
  async function startExtraction() {
    if (isExtracting) return;
    
    const options = {
      includeImages: includeImagesCheckbox.checked,
      enableOCR: enableOCRCheckbox.checked,
      format: document.querySelector('input[name="format"]:checked').value
    };
    
    isExtracting = true;
    setControlsDisabled(true);
    hideStatus();
    progressContainer.classList.add('show');
    progressBar.style.width = '0%';
    progressLabel.textContent = 'جاري بدء الاستخراج...';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'extract', options }, async (response) => {
        if (chrome.runtime.lastError) {
          showStatus('حدث خطأ. تأكد من أنك في صفحة الاختبار.', 'error');
          resetUI();
          return;
        }
        
        handleResponse(response, options);
      });
    } catch (error) {
      showStatus(`خطأ: ${error.message}`, 'error');
      resetUI();
    }
  }
  
  function handleResponse(response, options) {
    if (!response) {
      showStatus('لم يتم استلام استجابة من الصفحة.', 'error');
      resetUI();
      return;
    }
    
    switch (response.status) {
      case 'started':
        updateProgress(5, 'جاري تحميل محركات OCR...');
        break;
        
      case 'finding_questions':
        updateProgress(10, 'جاري البحث عن الأسئلة...');
        break;
        
      case 'questions_found':
        updateProgress(15, `تم العثور على ${response.count} سؤال`);
        break;
        
      case 'extracting_images':
        updateProgress(25, `جاري استخراج الصور من ${response.count} سؤال...`);
        break;
        
      case 'ocr_started':
        updateProgress(40, 'جاري قراءة النص من الصور (OCR)...');
        break;
        
      case 'ocr_progress':
        updateProgress(40 + (response.percent || 0), `جاري قراءة الصورة ${response.current}/${response.total}...`);
        break;
        
      case 'processing_answers':
        updateProgress(80, 'جاري معالجة الإجابات...');
        break;
        
      case 'generating_zip':
        updateProgress(90, 'جاري تعبئة ملف ZIP...');
        break;
        
      case 'complete':
        updateProgress(100, 'اكتمل الاستخراج!');
        downloadZip(response.data, options);
        break;
        
      case 'error':
        showStatus(`خطأ: ${response.message}`, 'error');
        resetUI();
        break;
        
      default:
        console.log('Unknown response:', response);
    }
  }
  
  function updateProgress(percent, label) {
    progressBar.style.width = percent + '%';
    if (label) {
      progressLabel.textContent = label;
    }
  }
  
  async function downloadZip(data, options) {
    try {
      progressLabel.textContent = 'جاري تحميل الملف...';
      
      chrome.runtime.sendMessage({
        action: 'download',
        data: data,
        options: options
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('تم الاستخراج لكن فشل التحميل.', 'error');
          resetUI();
          return;
        }
        
        showStatus('تم تحميل ملف ZIP بنجاح!', 'success');
        setTimeout(resetUI, 2000);
      });
    } catch (error) {
      showStatus(`خطأ في التحميل: ${error.message}`, 'error');
      resetUI();
    }
  }
  
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status show ' + type;
  }
  
  function hideStatus() {
    statusEl.className = 'status';
  }
  
  function setControlsDisabled(disabled) {
    extractBtn.disabled = disabled;
    includeImagesCheckbox.disabled = disabled;
    enableOCRCheckbox.disabled = disabled;
    formatRadios.forEach(radio => radio.disabled = disabled);
  }
  
  function resetUI() {
    isExtracting = false;
    setControlsDisabled(false);
    progressContainer.classList.remove('show');
    progressBar.style.width = '0%';
  }
  
  window.addEventListener('beforeunload', () => {
    isExtracting = false;
  });
});
