// Embedded repository logic using wikipedia_gap_detector_v0.2 data
const zambianEntities = [
  { name: "University of Zambia", type: "University", aliases: ["University of Zambia", "UNZA"], goldStandard: false },
  { name: "Copperbelt University", type: "University", aliases: ["Copperbelt University", "CBU"], goldStandard: false },
  { name: "Mulungushi University", type: "University", aliases: ["Mulungushi University"], goldStandard: false },
  { name: "Kwame Nkrumah University", type: "University", aliases: ["Kwame Nkrumah University"], goldStandard: false },
  { name: "Chalimbana University", type: "University", aliases: ["Chalimbana University"], goldStandard: false },
  { name: "Mukuba University", type: "University", aliases: ["Mukuba University"], goldStandard: false },
  { name: "Levy Mwanawasa Medical University", type: "University", aliases: ["Levy Mwanawasa Medical University", "LMMU"], goldStandard: false },
  { name: "Unicaf University", type: "University", aliases: ["Unicaf University"], goldStandard: false },
  { name: "Zambian Open University", type: "University", aliases: ["Zambian Open University", "ZAOU"], goldStandard: false },
  { name: "University of Lusaka", type: "University", aliases: ["University of Lusaka", "UNILUS"], goldStandard: false },
  { name: "Eden University", type: "University", aliases: ["Eden University"], goldStandard: false },
  { name: "Texila American University Zambia", type: "University", aliases: ["Texila American University Zambia", "Texila American University"], goldStandard: false },
  { name: "Rockview University", type: "University", aliases: ["Rockview University"], goldStandard: false },
  { name: "Rusangu University", type: "University", aliases: ["Rusangu University"], goldStandard: false },
  { name: "Livingstone International University of Tourism Excellence and Business Management", type: "University", aliases: ["Livingstone International University of Tourism Excellence and Business Management","LIUTEBM University","LIUTEBM"], goldStandard: false },
  { name: "Cavendish University Zambia", type: "University", aliases: ["Cavendish University Zambia", "Cavendish University"], goldStandard: false },
  { name: "Zambia Catholic University", type: "University", aliases: ["Zambia Catholic University", "ZCU"], goldStandard: false },
  { name: "DMI-St. Eugene University", type: "University", aliases: ["DMI-St. Eugene University","DMI St Eugene University","DMI–St Eugene University","DMI Saint Eugene University"], goldStandard: false },
  { name: "Lusaka City Council", type: "Council", aliases: ["Lusaka City Council"] },
  { name: "Ndola City Council", type: "Council", aliases: ["Ndola City Council"] },
  { name: "Kitwe City Council", type: "Council", aliases: ["Kitwe City Council"] },
  { name: "Livingstone City Council", type: "Council", aliases: ["Livingstone City Council"] },
  { name: "Chipata Municipal Council", type: "Council", aliases: ["Chipata Municipal Council"] },
  { name: "Kabwe Municipal Council", type: "Council", aliases: ["Kabwe Municipal Council"] },
  { name: "Choma Municipal Council", type: "Council", aliases: ["Choma Municipal Council"] },
  { name: "Kasama Municipal Council", type: "Council", aliases: ["Kasama Municipal Council"] },
  { name: "Solwezi Municipal Council", type: "Council", aliases: ["Solwezi Municipal Council"] },
  { name: "Mongu Municipal Council", type: "Council", aliases: ["Mongu Municipal Council"] },
  { name: "Mansa Municipal Council", type: "Council", aliases: ["Mansa Municipal Council"] },
  { name: "Chinsali Municipal Council", type: "Council", aliases: ["Chinsali Municipal Council"] },
  { name: "Samfya Town Council", type: "Council", aliases: ["Samfya Town Council"] },
  { name: "Senanga Town Council", type: "Council", aliases: ["Senanga Town Council"] },
  { name: "Chongwe Municipal Council", type: "Council", aliases: ["Chongwe Municipal Council"] },
  { name: "Luanshya Municipal Council", type: "Council", aliases: ["Luanshya Municipal Council"] },
  { name: "Mazabuka Municipal Council", type: "Council", aliases: ["Mazabuka Municipal Council"] },
  { name: "Kafue Municipal Council", type: "Council", aliases: ["Kafue Municipal Council"] },
  { name: "Chililabombwe Municipal Council", type: "Council", aliases: ["Chililabombwe Municipal Council"] },
  { name: "Chibombo Municipal Council", type: "Council", aliases: ["Chibombo Municipal Council"] }
];

// Render repository data in the repository.html
async function wikipediaPageExists(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const pages = data.query.pages;
    for (const pageId in pages) {
      if (pageId !== "-1") return true;
    }
  } catch (error) {
    console.error(`Error fetching Wikipedia API for ${title}:`, error);
  }
  return false;
}

async function calculateCompletenessScore(pageTitle, entityType) {
  const universityGoldSections = [
    "History","Campus","Academics","Administration","Faculties","Student life","Research","Notable alumni","References"
  ];
  const councilGoldSections = [
    "History","Geography","Governance","Elections","Functions","Departments","Budget","Infrastructure","Demographics","Leadership","Challenges","References"
  ];
  const goldStandardSections = entityType === "University" ? universityGoldSections : councilGoldSections;

  try {
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=sections|wikitext|revid&format=json&origin=*`;
    const resp = await fetch(parseUrl);
    const data = await resp.json();
    if (!data.parse) return 0;

    const sections = (data.parse.sections || []).map(s => s.line.toLowerCase());
    const wikitext = data.parse.wikitext["*"] || "";

    let matchedCount = 0;
    goldStandardSections.forEach(required => {
      if (sections.some(sec => sec.includes(required.toLowerCase()))) matchedCount++;
    });
    const sectionScore = (matchedCount / goldStandardSections.length) * 100;

    const infoboxPresent = /\{\{Infobox/i.test(wikitext);
    const infoboxScore = infoboxPresent ? 100 : 0;

    const refMatches = (wikitext.match(/<ref[\s\S]*?>[\s\S]*?<\/ref>/gi) || []).length;
    const plainText = wikitext.replace(/\{\{[^}]*\}\}/g, " ").replace(/\[\[[^\]]*\]\]/g, " ").replace(/<ref[\s\S]*?>[\s\S]*?<\/ref>/gi, " ");
    const wordCount = plainText.split(/\s+/).filter(Boolean).length || 1;
    const refsPer100Words = (refMatches / wordCount) * 100;
    const refScore = Math.min((refsPer100Words / 1) * 100, 100);

    const finalScore = Math.round((sectionScore * 0.5) + (infoboxScore * 0.2) + (refScore * 0.3));
    return finalScore;
  } catch (err) {
    console.error("calculateCompletenessScore error:", err);
    return 0;
  }
}

async function fetchPageContent(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections|wikitext|revid&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.parse) return null;
    return data.parse;
  } catch (err) {
    console.error("fetchPageContent error:", err);
    return null;
  }
}

function detectGapsAndSuggestions(parse, entityType) {
  const universityGoldSections = [
    "History","Campus","Academics","Administration","Faculties","Student life","Research","Notable alumni","References"
  ];
  const councilGoldSections = [
    "History","Geography","Governance","Elections","Functions","Departments","Budget","Infrastructure","Demographics","Leadership","Challenges","References"
  ];
  const goldStandardSections = entityType === "University" ? universityGoldSections : councilGoldSections;
  const sections = (parse.sections || []).map(s => s.line.toLowerCase());
  const wikitext = parse.wikitext["*"] || "";

  // Gaps
  const missingSections = goldStandardSections.filter(required =>
    !sections.some(sec => sec.includes(required.toLowerCase()))
  );
  const gaps = missingSections.map(section => `Missing section: ${section}`);

  // Suggestions
  const suggestions = [];
  missingSections.forEach(section => {
    suggestions.push(`Add a '${section}' section to improve completeness.`);
  });
  if (!/\{\{Infobox/i.test(wikitext)) {
    gaps.push('Missing infobox');
    suggestions.push('Add an infobox for key facts.');
  }
  const refMatches = (wikitext.match(/<ref[\s\S]*?>[\s\S]*?<\/ref>/gi) || []).length;
  if (refMatches < 5) {
    gaps.push('Insufficient references');
    suggestions.push('Add more reliable sources and citations.');
  }
  return { gaps, suggestions };
}

window.addEventListener('DOMContentLoaded', async () => {
  const universitiesList = document.getElementById('universities-list');
  const councilsList = document.getElementById('councils-list');
  universitiesList.innerHTML = '<li>Loading...</li>';
  councilsList.innerHTML = '<li>Loading...</li>';

  for (const entity of zambianEntities) {
    let exists = false;
    let score = null;
    if (await wikipediaPageExists(entity.name)) {
      exists = true;
      score = await calculateCompletenessScore(entity.name, entity.type);
    }
    const li = document.createElement('li');
    const statusClass = exists ? 'exists' : 'missing';
    const statusText = exists ? 'Exists ✅' : 'Missing ❌';
    let scoreHTML = '';
    if (exists && typeof score === 'number') {
      scoreHTML = `<span class=\"score\">Score: ${score}%</span>`;
    }
    li.innerHTML = `
      <span class=\"item-name\">${entity.name}</span>
      <div class=\"right\">
        <span class=\"${statusClass}\">${statusText}</span>
        ${scoreHTML}
      </div>
    `;
    if (entity.type === 'University') universitiesList.appendChild(li);
    else if (entity.type === 'Council') councilsList.appendChild(li);
  }
  if (universitiesList.innerHTML === '') universitiesList.innerHTML = '<li>No results</li>';
  if (councilsList.innerHTML === '') councilsList.innerHTML = '<li>No results</li>';
});
