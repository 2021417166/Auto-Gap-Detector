// Popup script for Auto Gap Detector
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

class PopupController {
  constructor() {
    this.detectedGaps = [];
    this.analysisHistory = [];
    this.settings = {
      autoAnalyze: true,
      showTooltips: true,
      focusOnZambia: true
    };
    
    this.init();
  }

  async init() {
    // Show loading state
    document.getElementById('loading').style.display = 'block';
    
    try {
      await this.loadData();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Popup initialization error:', error);
      this.showMessage('Error loading data. Please try again.');
    } finally {
      // Hide loading state
      document.getElementById('loading').style.display = 'none';
    }
  }

  async loadData() {
    try {
      const data = await chrome.storage.local.get([
        'detectedGaps', 
        'analysisHistory', 
        'settings'
      ]);
      
      this.detectedGaps = data.detectedGaps || [];
      this.analysisHistory = data.analysisHistory || [];
      
      // Merge settings with defaults
      this.settings = {
        ...this.settings,
        ...(data.settings || {})
      };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // Action buttons
    document.getElementById('analyze-current').addEventListener('click', 
      this.analyzeCurrentPage.bind(this));
    document.getElementById('view-repository').addEventListener('click', 
      this.openRepository.bind(this));
    document.getElementById('export-data').addEventListener('click', 
      this.exportData.bind(this));

    // Settings checkboxes
    document.getElementById('auto-analyze').addEventListener('change', 
      this.updateSettings.bind(this));
    document.getElementById('show-tooltips').addEventListener('change', 
      this.updateSettings.bind(this));
    document.getElementById('focus-zambia').addEventListener('change', 
      this.updateSettings.bind(this));

    // Modal close button
    this.setupRepositoryModalClose();
  }

  setupRepositoryModalClose() {
    const closeBtn = document.getElementById('close-repository-modal');
    const modal = document.getElementById('repository-modal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        const iframe = document.getElementById('repository-iframe');
        if (iframe) iframe.src = '';
      });
    }
  }

  updateUI() {
    // Update stats
    const totalGaps = this.detectedGaps.reduce((sum, item) => sum + item.gaps.length, 0);
    const avgScore = this.analysisHistory.length > 0 
      ? Math.round(this.analysisHistory.reduce((sum, item) => sum + item.score, 0) / this.analysisHistory.length)
      : 0;
    
    document.getElementById('total-gaps').textContent = this.detectedGaps.length;
    document.getElementById('pages-analyzed').textContent = this.analysisHistory.length;
    document.getElementById('avg-score').textContent = `${avgScore}%`;

    // Update recent gaps list
    const recentGapsList = document.getElementById('recent-gaps-list');
    recentGapsList.innerHTML = '';
    
    if (this.detectedGaps.length === 0) {
      recentGapsList.innerHTML = `
        <li class="no-gaps">
          No gaps detected yet. Visit Wikipedia pages to start analyzing!
        </li>
      `;
    } else {
      // Show last 3 detected gaps (most recent first)
      const recentGaps = [...this.detectedGaps].reverse().slice(0, 3);
      
      recentGaps.forEach(gap => {
        const highPriorityGaps = gap.gaps.filter(g => g.severity === 'high').length;
        const scoreClass = gap.score >= 80 ? 'high' : gap.score >= 60 ? 'medium' : 'low';
        
        const li = document.createElement('li');
        li.className = 'gap-item';
        li.innerHTML = `
          <div class="gap-header">
            <span class="gap-title">${gap.page}</span>
            <span class="gap-score ${scoreClass}">${gap.score}%</span>
          </div>
          <div class="gap-details">
            <span class="gap-count">${gap.gaps.length} gaps</span>
            ${highPriorityGaps > 0 
              ? `<span class="gap-priority">${highPriorityGaps} high priority</span>` 
              : ''}
          </div>
        `;
        
        li.addEventListener('click', () => {
          chrome.tabs.create({ url: gap.url });
        });
        
        recentGapsList.appendChild(li);
      });
    }

    // Update settings checkboxes
    document.getElementById('auto-analyze').checked = this.settings.autoAnalyze;
    document.getElementById('show-tooltips').checked = this.settings.showTooltips;
    document.getElementById('focus-zambia').checked = this.settings.focusOnZambia;
  }

  async analyzeCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });

      if (!tab.url.includes('wikipedia.org')) {
        this.showMessage('Please navigate to a Wikipedia page first.');
        return;
      }

      // Send message to content script to analyze current page
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          if (window.gapDetector) {
            window.gapDetector.analyzeCurrentPage();
          }
        }
      });

      this.showMessage('Analysis started! Check the page for results.');
      
      // Refresh data after short delay to show new results
      setTimeout(async () => {
        await this.loadData();
        this.updateUI();
      }, 2000);
    } catch (error) {
      console.error('Error analyzing current page:', error);
      this.showMessage('Error analyzing page. Please try again.');
    }
  }

  openRepository() {
    // Show the modal overlay and load repository.html in the iframe
    const modal = document.getElementById('repository-modal');
    const iframe = document.getElementById('repository-iframe');
    if (modal && iframe) {
      iframe.src = chrome.runtime.getURL('repository.html');
      modal.style.display = 'flex';
    }
  }



  async updateSettings() {
    // Update settings object from UI state
    this.settings = {
      autoAnalyze: document.getElementById('auto-analyze').checked,
      showTooltips: document.getElementById('show-tooltips').checked,
      focusOnZambia: document.getElementById('focus-zambia').checked
    };

    try {
      // Save to storage
      await chrome.storage.local.set({ settings: this.settings });
      this.showMessage('Settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showMessage('Error saving settings. Please try again.');
    }
  }

  exportData() {
    try {
      const exportData = {
        metadata: {
          generatedAt: new Date().toISOString(),
          extensionVersion: '1.0.0'
        },
        summary: {
          totalGaps: this.detectedGaps.length,
          totalGapItems: this.detectedGaps.reduce((sum, item) => sum + item.gaps.length, 0),
          pagesAnalyzed: this.analysisHistory.length,
          averageScore: this.analysisHistory.length > 0 
            ? Math.round(this.analysisHistory.reduce((sum, item) => sum + item.score, 0) / this.analysisHistory.length)
            : 0
        },
        detectedGaps: this.detectedGaps,
        analysisHistory: this.analysisHistory
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `gap-detector-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      this.showMessage('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage('Error exporting data. Please try again.');
    }
  }

  showMessage(message) {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }
}