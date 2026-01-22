document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  const includeImagesCheckbox = document.getElementById('includeImages');
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
    progressLabel.textContent = 'Starting extraction...';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'extract', options }, async (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error. Make sure you are on a quiz page.', 'error');
          resetUI();
          return;
        }
        
        handleResponse(response, options);
      });
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
      resetUI();
    }
  }
  
  function handleResponse(response, options) {
    if (!response) {
      showStatus('No response received from page.', 'error');
      resetUI();
      return;
    }
    
    switch (response.status) {
      case 'started':
        updateProgress(5, 'Loading OCR engine...');
        break;
        
      case 'finding_questions':
        updateProgress(10, 'Finding questions...');
        break;
        
      case 'questions_found':
        updateProgress(15, `Found ${response.count} questions`);
        break;
        
      case 'extracting_images':
        updateProgress(25, `Extracting images from ${response.count} questions...`);
        break;
        
      case 'ocr_started':
        updateProgress(40, 'Running OCR on images...');
        break;
        
      case 'ocr_progress':
        updateProgress(40 + (response.percent || 0), `Processing image ${response.current}/${response.total}...`);
        break;
        
      case 'processing_answers':
        updateProgress(80, 'Processing answers...');
        break;
        
      case 'generating_zip':
        updateProgress(90, 'Creating ZIP file...');
        break;
        
      case 'complete':
        updateProgress(100, 'Extraction complete!');
        downloadZip(response.data, options);
        break;
        
      case 'error':
        showStatus(`Error: ${response.message}`, 'error');
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
      progressLabel.textContent = 'Downloading file...';
      
  chrome.runtime.sendMessage({
    action: 'download',
    data: data,
    options: options
  }, (response) => {
    console.log('Download response:', response);
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showStatus('Extraction done but download failed: ' + chrome.runtime.lastError.message, 'error');
      resetUI();
      return;
    }
    
    if (response && response.success) {
      console.log('Download successful!');
      showStatus('Download started! Check Downloads folder.', 'success');
      setTimeout(resetUI, 3000);
    } else {
      console.error('Download failed:', response?.error);
      showStatus('Download failed: ' + (response?.error || 'Unknown error'), 'error');
      resetUI();
    }
  });
    } catch (error) {
      showStatus(`Download error: ${error.message}`, 'error');
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
