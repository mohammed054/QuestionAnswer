chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download' && message.blob) {
    (async () => {
      try {
        console.log('Starting download...');
        console.log('Blob type:', message.blob.type);
        console.log('Blob size:', message.blob.size);
        
        const url = URL.createObjectURL(message.blob);
        console.log('Blob URL created');
        
        const downloadId = await chrome.downloads.download({
          url: url,
          filename: message.filename,
          saveAs: false
        });
        
        console.log('Download initiated with ID:', downloadId);
        
        // Clean up URL after delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 5000);
        
        sendResponse({ success: true, downloadId });
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
