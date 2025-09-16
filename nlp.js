import { loadTemplate } from './templates.js';

export function analyzeContent(content, template) {
  const analysis = {
    score: 100,
    missingSections: [],
    incompleteSections: []
  };

  // Check missing sections
  template.requiredSections.forEach(section => {
    if (!content.sections.some(s => s.title.toLowerCase() === section.toLowerCase())) {
      analysis.missingSections.push(section);
      analysis.score -= 5;
    }
  });

  // Check section content quality
  content.sections.forEach(section => {
    const templateSection = template.sections.find(s => 
      s.title.toLowerCase() === section.title.toLowerCase()
    );
    
    if (templateSection) {
      // Check entity coverage
      const entityCoverage = calculateEntityCoverage(section.content, templateSection.entities);
      if (entityCoverage < 0.7) {
        analysis.incompleteSections.push({
          title: section.title,
          reason: `Low coverage of required entities (${Math.round(entityCoverage * 100)}%)`
        });
        analysis.score -= 3;
      }
      
      // Check content length
      const wordCount = section.content.split(/\s+/).length;
      if (wordCount < templateSection.minWords) {
        analysis.incompleteSections.push({
          title: section.title,
          reason: `Section too short (${wordCount} words, minimum ${templateSection.minWords} required)`
        });
        analysis.score -= 2;
      }
    }
  });

  // Check references
  if (content.references < template.minReferences) {
    analysis.score -= (template.minReferences - content.references) * 2;
    analysis.incompleteSections.push({
      title: 'References',
      reason: `Insufficient references (${content.references}/${template.minReferences})`
    });
  }

  // Ensure score doesn't go below 0
  analysis.score = Math.max(0, Math.round(analysis.score));
  return analysis;
}

function calculateEntityCoverage(text, entities) {
  const foundEntities = entities.filter(entity => 
    text.toLowerCase().includes(entity.toLowerCase())
  );
  return foundEntities.length / entities.length;
}