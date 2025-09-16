export async function loadTemplate(type) {
  const templateName = type === 'university' 
    ? 'university_template' 
    : 'council_template';
  
  const response = await fetch(chrome.runtime.getURL(`templates/${templateName}.json`));
  return await response.json();
}