// Content script for Auto Gap Detector
class GapDetector {
  constructor() {
    this.goldStandardTemplates = {
      university: {
        requiredSections: [
          'History', 'Academic programs', 'Notable alumni', 'Research',
          'Campus', 'Administration', 'Student life', 'References'
        ],
        requiredEntities: ['founded', 'location', 'type', 'students'],
        minCitations: 10
      },
      municipalCouncil: {
        requiredSections: [
          'History', 'Geography', 'Demographics', 'Economy',
          'Administration', 'Education', 'Healthcare', 'References'
        ],
        requiredEntities: ['population', 'area', 'established', 'mayor'],
        minCitations: 8
      }
    };

  this.hfApiKey = 'YOUR_HF_API_KEY_HERE'; // Insert your Hugging Face API key at runtime or via environment variable
    this.hfModel = 'HuggingFaceH4/zephyr-7b-beta'; // Instruction-following model

    this.zambianKeywords = [
      'zambia', 'zambian', 'lusaka', 'copperbelt', 'ndola', 'kitwe',
      'livingstone', 'chipata', 'kasama', 'mongu', 'solwezi', 'kabwe'
    ];
    
    this.init();
  }

  init() {
    if (this.isWikipediaPage()) {
      this.setupUI();
      this.analyzeCurrentPage();
    }
  }

  isWikipediaPage() {
    return window.location.hostname.includes('wikipedia.org');
  }

  setupUI() {
    this.createAnalysisPanel();
    this.createTooltipContainer();
  }

  createAnalysisPanel() {
    const panel = document.createElement('div');
    panel.id = 'gap-detector-panel';
    panel.innerHTML = `
      <div class="gap-detector-header">
        <h3>Auto Gap Detector</h3>
        <button id="toggle-panel">-</button>
      </div>
      <div class="gap-detector-content">
        <div class="completeness-score">
          <div class="score-circle">
            <span id="score-value">0%</span>
          </div>
          <span class="score-label">Completeness Score</span>
          <span id="last-analysis" style="display:block;font-size:12px;color:#888;margin-top:4px;"></span>
        </div>
        <div class="detected-gaps">
          <h4>Detected Gaps</h4>
          <ul id="gaps-list"></ul>
        </div>
        <div class="suggestions">
          <h4>Suggestions <button id="copy-suggestions" style="float:right;font-size:12px;">Copy</button></h4>
          <ul id="suggestions-list"></ul>
        </div>
        <button id="edit-wiki-btn" style="margin-top:10px;">Edit this article</button>
        <button id="analyze-btn">Re-analyze</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('toggle-panel').addEventListener('click', 
      this.togglePanel.bind(this));
    document.getElementById('analyze-btn').addEventListener('click', 
      this.analyzeCurrentPage.bind(this));
    document.getElementById('copy-suggestions').addEventListener('click', () => {
      const suggestions = Array.from(document.querySelectorAll('#suggestions-list li')).map(li => li.textContent).join('\n');
      navigator.clipboard.writeText(suggestions);
      document.getElementById('copy-suggestions').textContent = 'Copied!';
      setTimeout(() => {
        document.getElementById('copy-suggestions').textContent = 'Copy';
      }, 1200);
    });
    document.getElementById('edit-wiki-btn').addEventListener('click', () => {
      const editUrl = window.location.href.replace(/\/wiki\/([^#?]+)/, '/w/index.php?title=$1&action=edit');
      window.open(editUrl, '_blank');
    });
  } // End of constructor

  async runAISuggestions() {
    // Removed: LLM is now always used in analyzeCurrentPage
  }

  async callHuggingFaceAPI(promptText) {
    const apiUrl = `https://api-inference.huggingface.co/models/${this.hfModel}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hfApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: promptText })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    // For text-generation models, output is in result[0].generated_text or result.generated_text
    if (Array.isArray(result) && result[0]?.generated_text) return result[0].generated_text;
    if (result.generated_text) return result.generated_text;
    // For other models, try summary_text or data field
    if (result[0]?.summary_text) return result[0].summary_text;
    if (result.data) return result.data;
    return JSON.stringify(result);
  }

  createTooltipContainer() {
    const container = document.createElement('div');
    container.id = 'gap-detector-tooltip';
    container.className = 'gap-tooltip hidden';
    document.body.appendChild(container);
  }

  togglePanel() {
    const panel = document.getElementById('gap-detector-panel');
    const content = panel.querySelector('.gap-detector-content');
    const toggle = document.getElementById('toggle-panel');

    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '-';
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
    }
  }

  async analyzeCurrentPage() {
    const pageTitle = document.title.replace(' - Wikipedia', '');
    const pageContent = this.extractPageContent();

    // Always use LLM for gap detection, suggestions, and notable people recommendations
    try {
      const prompt = `You are an expert Wikipedia editor. Review the following article and:
1. Suggest missing sections or improvements to make it more complete, based on best practices for this topic.
2. Identify any notable people mentioned (especially in the infobox or main text) who do not have their own articles, and recommend creating articles for them, including suggested sections for those new articles.
Respond in JSON with these keys:
  - score: (number, 0-100, completeness score)
  - gaps: array of {type, content, severity}
  - suggestions: array of strings (for improving the article)
  - new_articles: array of {name, rationale, suggested_sections}

Article text:
${pageContent.text}`;
      const result = await this.callHuggingFaceAPI(prompt);
      let analysis;
      try {
        analysis = typeof result === 'string' ? JSON.parse(result) : result;
      } catch (e) {
        // fallback: show raw output if not valid JSON
        analysis = {
          score: 'N/A',
          gaps: [],
          suggestions: [typeof result === 'string' ? result : JSON.stringify(result)],
          new_articles: []
        };
      }
      this.updatePanel(analysis);
      this.highlightGaps(analysis.gaps || []);
      this.saveAnalysis(pageTitle, analysis);
      // Optionally, display new_articles in the UI (future step)
    } catch (err) {
      this.updatePanel({
        score: 'N/A',
        gaps: [],
        suggestions: [err.message || 'LLM analysis failed.'],
        new_articles: []
      });
    }
  }

  extractPageContent() {
    const content = {
      title: document.title,
      sections: [],
      text: '',
      citations: 0,
      infobox: {}
    };

    // Extract sections
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      content.sections.push(heading.textContent.trim());
    });

    // Extract main text
    const bodyContent = document.getElementById('mw-content-text');
    if (bodyContent) {
      content.text = bodyContent.textContent.toLowerCase();
    }

    // Count citations
    const citations = document.querySelectorAll('.reference, .cite');
    content.citations = citations.length;

    // Extract infobox data
    const infobox = document.querySelector('.infobox');
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0].textContent.trim().toLowerCase();
          const value = cells[1].textContent.trim();
          content.infobox[key] = value;
        }
      });
    }

    return content;
  }

  isRelevantToZambia(content) {
    const text = content.text.toLowerCase();
    return this.zambianKeywords.some(keyword => text.includes(keyword));
  }

  detectArticleType(content) {
    const text = content.text.toLowerCase();
    const title = content.title.toLowerCase();

    const universityKeywords = ['university', 'college', 'institute', 'school', 'academy'];
    const municipalKeywords = ['council', 'municipality', 'district', 'city', 'town'];
    
    if (universityKeywords.some(kw => title.includes(kw) || text.includes(kw))) {
      return 'university';
    }

    if (municipalKeywords.some(kw => title.includes(kw) || text.includes(kw))) {
      return 'municipalCouncil';
    }

    return 'general';
  }

  performAnalysis(content, articleType) {
    const template = this.goldStandardTemplates[articleType];
    if (!template) {
      return { 
        score: 50, 
        gaps: [], 
        suggestions: ['Article type not recognized for detailed analysis'] 
      };
    }

    const analysis = {
      score: 0,
      gaps: [],
      suggestions: []
    };

    // Check required sections
    const missingSections = template.requiredSections.filter(section =>
      !content.sections.some(s => s.toLowerCase().includes(section.toLowerCase()))
    );

    analysis.gaps.push(...missingSections.map(section => ({
      type: 'missing_section',
      content: section,
      severity: 'high'
    })));

    // Check required entities in infobox
    const missingEntities = template.requiredEntities.filter(entity =>
      !Object.keys(content.infobox).some(key => key.includes(entity))
    );

    analysis.gaps.push(...missingEntities.map(entity => ({
      type: 'missing_entity',
      content: entity,
      severity: 'medium'
    })));

    // Check citations
    if (content.citations < template.minCitations) {
      analysis.gaps.push({
        type: 'insufficient_citations',
        content: `Only ${content.citations} citations found, minimum ${template.minCitations} recommended`,
        severity: 'high'
      });
    }

    // Calculate completeness score
    const totalChecks = template.requiredSections.length + 
                        template.requiredEntities.length + 1;
    const passedChecks = totalChecks - analysis.gaps.length;
    analysis.score = Math.round((passedChecks / totalChecks) * 100);

    // Generate suggestions
    analysis.suggestions = this.generateSuggestions(analysis.gaps, articleType);

    return analysis;
  }

  generateSuggestions(gaps, articleType) {
    const suggestions = [];

    gaps.forEach(gap => {
      switch (gap.type) {
        case 'missing_section':
          suggestions.push(`Add a '${gap.content}' section to improve article completeness`);
          break;
        case 'missing_entity':
          suggestions.push(`Include '${gap.content}' information in the infobox`);
          break;
        case 'insufficient_citations':
          suggestions.push('Add more reliable sources and citations');
          break;
      }
    });

    // Add general suggestions based on article type
    if (articleType === 'university') {
      suggestions.push('Consider adding information about academic partnerships');
      suggestions.push('Include notable faculty members if available');
    } else if (articleType === 'municipalCouncil') {
      suggestions.push('Add information about local government structure');
      suggestions.push('Include economic development initiatives');
    }

    return suggestions;
  }

  updatePanel(analysis) {
    document.getElementById('score-value').textContent = `${analysis.score}%`;
    const scoreElement = document.getElementById('score-value');
    scoreElement.className = analysis.score >= 80 ? 'high-score' :
                             analysis.score >= 60 ? 'medium-score' : 'low-score';

    // Show last analysis timestamp
    const lastAnalysis = document.getElementById('last-analysis');
    lastAnalysis.textContent = `Last analyzed: ${new Date().toLocaleString()}`;

    const gapsList = document.getElementById('gaps-list');
    gapsList.innerHTML = '';
    analysis.gaps.forEach(gap => {
      const li = document.createElement('li');
      li.className = `gap-item ${gap.severity}`;
      li.textContent = gap.content;
      if (gap.severity === 'high') {
        li.style.color = '#d32f2f';
        li.style.fontWeight = 'bold';
        li.innerHTML = `<span style="color:#d32f2f;font-weight:bold;">&#9888;</span> ${gap.content}`;
      }
      gapsList.appendChild(li);
    });

    const suggestionsList = document.getElementById('suggestions-list');
    suggestionsList.innerHTML = '';
    analysis.suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.textContent = suggestion;
      suggestionsList.appendChild(li);
    });
  }

  highlightGaps(gaps) {
    // Remove previous highlights and tooltips
    document.querySelectorAll('.missing-section-marker, .inline-gap-tooltip').forEach(el => {
      el.remove();
    });

    // Process each gap
    gaps.forEach(gap => {
      switch (gap.type) {
        case 'missing_section':
          this.addInlineSectionSuggestion(gap, true);
          break;
        case 'missing_entity':
          this.addInfoboxSuggestion(gap, true);
          break;
        case 'insufficient_citations':
          this.addCitationSuggestion(gap, true);
          break;
      }
    });
  }

  findInsertionPoint(sectionName) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
    const sectionIndex = this.goldStandardTemplates[this.detectArticleType(this.extractPageContent())]
      .requiredSections.indexOf(sectionName);
    
    // Find the appropriate position based on template order
    for (let i = 0; i < headings.length; i++) {
      const currentIndex = this.goldStandardTemplates[this.detectArticleType(this.extractPageContent())]
        .requiredSections.findIndex(section => 
          headings[i].textContent.toLowerCase().includes(section.toLowerCase())
        );
      
      if (currentIndex > sectionIndex) {
        return headings[i];
      }
    }
    
    // If no suitable position found, return the references section or end of content
    return document.querySelector('#References, .references') || 
           document.querySelector('#mw-content-text > .mw-parser-output');
  }

  addInlineSectionSuggestion(gap) {
    const insertionPoint = this.findInsertionPoint(gap.content);
    if (!insertionPoint) return;

    const suggestionMarker = document.createElement('div');
    suggestionMarker.className = 'missing-section-marker';
    suggestionMarker.style.background = '#e3f2fd'; // blue highlight for suggestions
    suggestionMarker.style.borderColor = '#1976d2';
    suggestionMarker.style.color = '#1976d2';

    const tooltip = document.createElement('div');
    tooltip.className = 'inline-gap-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <div class="suggestion-type">Suggested Section: ${gap.content}</div>
        <div class="suggestion-content">
          This article would be more complete with a ${gap.content} section.<br>
          <span style="color:#1976d2;">${this.getSectionGuidelines(gap.content)}</span>
        </div>
      </div>
    `;

    suggestionMarker.textContent = `Suggested: ${gap.content} section`;
    suggestionMarker.appendChild(tooltip);
    
    insertionPoint.parentNode.insertBefore(suggestionMarker, insertionPoint);
  }

  addInfoboxSuggestion(gap) {
    const infobox = document.querySelector('.infobox');
    if (!infobox) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'inline-gap-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <div class="suggestion-type">Missing Information</div>
        <div class="suggestion-content">
          <span style="color:#1976d2;">Add ${gap.content} information to the infobox to improve completeness.<br>${this.getEntityGuidelines(gap.content)}</span>
        </div>
      </div>
    `;

    infobox.parentNode.insertBefore(tooltip, infobox.nextSibling);
  }

  addCitationSuggestion(gap) {
    const referencesSection = document.querySelector('#References, .references');
    if (!referencesSection) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'inline-gap-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <div class="suggestion-type">Citation Needed</div>
        <div class="suggestion-content">
          <span style="color:#1976d2;">${gap.content}<br>Consider adding citations from:
          <ul>
            <li>Academic journals</li>
            <li>Official documents</li>
            <li>Reliable news sources</li>
          </ul></span>
        </div>
      </div>
    `;

    referencesSection.parentNode.insertBefore(tooltip, referencesSection);
  }

  getSectionGuidelines(sectionName) {
    const guidelines = {
      'History': 'Include founding date, key milestones, and significant changes over time.',
      'Academic programs': 'List major departments, degrees offered, and special programs.',
      'Notable alumni': 'Mention graduates who have made significant contributions.',
      'Research': 'Highlight major research areas, projects, and achievements.',
      // Add more section-specific guidelines
    };
    return guidelines[sectionName] || 'Add relevant information about this topic.';
  }

  getEntityGuidelines(entityName) {
    const guidelines = {
      'founded': 'Add the establishment date and founding context.',
      'location': 'Include city, region, and geographical coordinates.',
      'type': 'Specify the type of institution or organization.',
      'students': 'Add current enrollment numbers and demographics.',
      // Add more entity-specific guidelines
    };
    return guidelines[entityName] || 'Add this important information to the infobox.';
  }

  validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid analysis object');
    }

    if (typeof analysis.score !== 'number' || analysis.score < 0 || analysis.score > 100) {
      throw new Error('Invalid score value');
    }

    if (!Array.isArray(analysis.gaps)) {
      throw new Error('Gaps must be an array');
    }

    analysis.gaps.forEach((gap, index) => {
      if (!gap.type || !gap.content || !gap.severity) {
        throw new Error(`Invalid gap object at index ${index}`);
      }
      if (!['high', 'medium', 'low'].includes(gap.severity)) {
        throw new Error(`Invalid severity value at index ${index}`);
      }
    });
  }

  async saveAnalysis(pageTitle, analysis) {
    try {
      // Validate inputs
      if (!pageTitle || typeof pageTitle !== 'string') {
        throw new Error('Invalid page title');
      }
      this.validateAnalysis(analysis);

      // Get current state and settings
      const data = await chrome.storage.local.get([
        'detectedGaps', 
        'analysisHistory',
        'settings'
      ]);
      
      const gapEntry = {
        page: pageTitle,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        gaps: analysis.gaps,
        score: analysis.score,
        offlineCreated: data.settings?.offlineMode || false
      };

      let detectedGaps = data.detectedGaps || [];
      const analysisHistory = data.analysisHistory || [];
      const maxHistoryItems = data.settings?.maxHistoryItems || 100;

      // Add to gaps if significant gaps found
      if (analysis.gaps.length > 0) {
        detectedGaps.push(gapEntry);
        // Limit to 3 most recent gaps
        while (detectedGaps.length > 3) {
          detectedGaps.shift();
        }
      }

      // Add to history with size limit
      analysisHistory.push(gapEntry);
      while (analysisHistory.length > maxHistoryItems) {
        analysisHistory.shift();
      }

      // Save to storage
      await chrome.storage.local.set({
        detectedGaps,
        analysisHistory
      });

      // If online, try to sync with server
      if (!data.settings?.offlineMode) {
        chrome.runtime.sendMessage({
          action: 'sync_data',
          data: gapEntry
        }).catch(error => {
          handleError(error, 'sync_analysis');
        });
      }

    } catch (error) {
      handleError(error, 'save_analysis');
      throw error; // Re-throw to handle in calling context
    }
  }
}

// Error handling wrapper
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  chrome.runtime.sendMessage({
    action: 'log_error',
    data: {
      context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }
  });
};

// Cleanup function
const cleanup = () => {
  try {
    // Remove panel if it exists
    const panel = document.getElementById('gap-detector-panel');
    if (panel) panel.remove();

    // Remove highlights
    document.querySelectorAll('.gap-highlight').forEach(el => {
      el.classList.remove('gap-highlight');
    });

    // Remove missing section indicators
    document.querySelectorAll('.missing-section-indicator').forEach(el => {
      el.remove();
    });
  } catch (error) {
    handleError(error, 'cleanup');
  }
};

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      cleanup(); // Clean up any existing elements first
      window.gapDetector = new GapDetector();
    } catch (error) {
      handleError(error, 'initialization');
    }
  });
} else {
  try {
    cleanup(); // Clean up any existing elements first
    window.gapDetector = new GapDetector();
  } catch (error) {
    handleError(error, 'initialization');
  }
}

// Cleanup on navigation
window.addEventListener('beforeunload', cleanup);

// Handle extension updates/reloads
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'reload') {
    try {
      cleanup();
      window.gapDetector = new GapDetector();
      sendResponse({ success: true });
    } catch (error) {
      handleError(error, 'reload');
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});