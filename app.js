// Global variables
let isAdminLoggedIn = false;
let currentExam = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let examTimer = null;
let timeRemaining = 0;
let startTime = null;
let aiGeneratedQuestion = null;
let extractedQuestions = [];
let candidateDetailedAnswers = null; // Store candidate's detailed results for viewing
let currentScreen = 'hero-landing'; // Track current screen for navigation

// App Version for cache invalidation on new deployments
// Update this version when deploying significant changes to clear old sessions
const APP_VERSION = '2.2.0';
const APP_VERSION_KEY = 'polite_app_version';

// =====================================================
// RICH CONTENT RENDERING - Math, Images, Graphs
// =====================================================
/**
 * RICH CONTENT SYNTAX GUIDE
 * =========================
 *
 * The following syntax can be used in question text and options:
 *
 * 1. MATH EXPRESSIONS (LaTeX/KaTeX)
 *    - Inline math: $x^2 + y^2 = z^2$ or \(x^2 + y^2 = z^2\)
 *    - Display math (centered): $$\frac{-b \pm \sqrt{b^2-4ac}}{2a}$$ or \[\frac{-b \pm \sqrt{b^2-4ac}}{2a}\]
 *    - Examples: $\sqrt{2}$, $\pi r^2$, $\sum_{i=1}^{n} i$, $\int_0^1 x dx$
 *
 * 2. IMAGES
 *    - Syntax: [img:URL] or [image:URL]
 *    - Example: [img:https://example.com/diagram.png]
 *    - Images are clickable to view full size
 *
 * 3. GRAPHS (Chart.js)
 *    - Simple format: [graph:type:label1,value1;label2,value2;...]
 *    - Types: line, bar, pie, doughnut
 *    - Example: [graph:bar:Jan,10;Feb,20;Mar,15;Apr,25]
 *    - Example: [graph:pie:Correct,75;Incorrect,20;Skipped,5]
 *
 * 4. TABLES
 *    - Syntax: [table:header1,header2|row1col1,row1col2|row2col1,row2col2]
 *    - Example: [table:Name,Score|Alice,85|Bob,92|Charlie,78]
 *
 * 5. SIMPLE SYNTAX (Auto-converted to LaTeX)
 *    - Powers: 2^2, x^10, a^{n+1} - automatically wrapped in $...$
 *    - Subscripts: x_1, a_n - automatically wrapped in $...$
 *    - Square root: sqrt(x), sqrt(a+b) - becomes $\sqrt{x}$
 *    - Fractions: 1/2, (a+b)/c - converted to fractions
 *    - Symbols: pi, alpha, beta, theta, infinity - Greek letters
 *    - Comparisons: >=, <=, != - become >= <= != symbols
 *    - Operations: +- and multiplication/division symbols
 *
 * 6. AIRTABLE FIELD SUPPORT
 *    - Store the raw syntax directly in Airtable fields
 *    - Question, Option A-D, and Main Question Text fields all support rich content
 *    - No need for special field types - regular text fields work fine
 */

/**
 * Converts simple/natural math syntax to LaTeX
 * Makes it easy for non-technical users to write math expressions
 * Only converts clear mathematical patterns, leaves everything else as-is
 * @param {string} text - The text with simple math syntax
 * @returns {string} - Text with LaTeX math expressions
 */
function convertSimpleMathToLatex(text) {
    if (!text || typeof text !== 'string') return text;

    // If already contains LaTeX delimiters, don't process - return as-is
    if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
        return text;
    }

    let result = text;

    // Convert sqrt(expression) to $\sqrt{expression}$
    result = result.replace(/sqrt\(([^)]+)\)/gi, (match, expr) => {
        return `$\\sqrt{${expr.trim()}}$`;
    });

    // Convert cbrt(expression) to $\sqrt[3]{expression}$
    result = result.replace(/cbrt\(([^)]+)\)/gi, (match, expr) => {
        return `$\\sqrt[3]{${expr.trim()}}$`;
    });

    // Convert frac(a,b) to $\frac{a}{b}$
    result = result.replace(/frac\(([^,]+),([^)]+)\)/gi, (match, num, den) => {
        return `$\\frac{${num.trim()}}{${den.trim()}}$`;
    });

    // Convert sum(i=1,n) to $\sum_{i=1}^{n}$
    result = result.replace(/sum\(([^,]+),([^)]+)\)/gi, (match, from, to) => {
        return `$\\sum_{${from.trim()}}^{${to.trim()}}$`;
    });

    // Convert integral(a,b) to $\int_{a}^{b}$
    result = result.replace(/integral\(([^,]+),([^)]+)\)/gi, (match, from, to) => {
        return `$\\int_{${from.trim()}}^{${to.trim()}}$`;
    });

    // Convert power expressions: x^2, x^10
    result = result.replace(/([a-zA-Z0-9])\^(\d+)/g, (match, base, exp) => {
        return `$${base}^{${exp}}$`;
    });

    // Convert subscript expressions: x_1, a_n
    result = result.replace(/([a-zA-Z])_(\d+)/g, (match, base, sub) => {
        return `$${base}_{${sub}}$`;
    });
    result = result.replace(/([a-zA-Z])_([a-zA-Z])\b/g, (match, base, sub) => {
        return `$${base}_{${sub}}$`;
    });

    // Convert common fractions like 1/2, 1/3, 1/4, 2/3, 3/4
    result = result.replace(/\b(1|2|3|4|5|6|7)\/(2|3|4|5|6|8)\b/g, (match, num, den) => {
        return `$\\frac{${num}}{${den}}$`;
    });

    // Convert degrees: 90deg to $90^\circ$
    result = result.replace(/(\d+)\s*deg\b/gi, (match, num) => {
        return `$${num}^\\circ$`;
    });

    // Merge adjacent math expressions: $a$ $b$ → $a b$
    result = result.replace(/\$([^$]+)\$\s*\$([^$]+)\$/g, '$$$1 $2$$');

    return result;
}

/**
 * Renders rich content including LaTeX math, images, and graphs
 * @param {string} content - The content to render
 * @param {HTMLElement} element - The element to render into
 * @param {boolean} isOption - Whether this is an option (smaller rendering)
 */
function renderRichContent(content, element, isOption = false) {
    if (!content || !element) return;

    // First, convert simple math syntax to LaTeX
    content = convertSimpleMathToLatex(content);

    // Create a container with rich-content class
    element.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'rich-content';

    // Process content step by step
    let processedContent = escapeHtmlForRichContent(content);

    // Extract and preserve image placeholders
    const imagePlaceholders = [];
    processedContent = processedContent.replace(/\[(?:img|image):([^\]]+)\]/gi, (match, url) => {
        const placeholder = `__IMAGE_${imagePlaceholders.length}__`;
        imagePlaceholders.push(url.trim());
        return placeholder;
    });

    // Extract and preserve graph placeholders
    const graphPlaceholders = [];
    processedContent = processedContent.replace(/\[graph:([^\]]+)\]/gi, (match, graphData) => {
        const placeholder = `__GRAPH_${graphPlaceholders.length}__`;
        graphPlaceholders.push(graphData.trim());
        return placeholder;
    });

    // Extract and preserve table placeholders
    const tablePlaceholders = [];
    processedContent = processedContent.replace(/\[table:([^\]]+)\]/gi, (match, tableData) => {
        const placeholder = `__TABLE_${tablePlaceholders.length}__`;
        tablePlaceholders.push(tableData.trim());
        return placeholder;
    });

    // Convert newlines to <br> for proper display
    processedContent = processedContent.replace(/\n/g, '<br>');

    // Set the initial content
    container.innerHTML = processedContent;

    // Replace image placeholders with actual images
    imagePlaceholders.forEach((url, index) => {
        const placeholder = `__IMAGE_${index}__`;
        const imgHtml = createImageHtml(url, isOption);
        container.innerHTML = container.innerHTML.replace(placeholder, imgHtml);
    });

    // Replace table placeholders with actual tables
    tablePlaceholders.forEach((tableData, index) => {
        const placeholder = `__TABLE_${index}__`;
        const tableHtml = createTableHtml(tableData);
        container.innerHTML = container.innerHTML.replace(placeholder, tableHtml);
    });

    element.appendChild(container);

    // Render LaTeX math expressions using KaTeX
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(container, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\[', right: '\\]', display: true},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false,
                strict: false
            });
        } catch (e) {
            console.warn('KaTeX rendering error:', e);
        }
    }

    // Render graphs
    graphPlaceholders.forEach((graphData, index) => {
        const placeholder = `__GRAPH_${index}__`;
        const placeholderElement = container.querySelector(`[data-graph-placeholder="${index}"]`);
        if (!placeholderElement) {
            // Find the placeholder text and replace with graph container
            const graphContainer = document.createElement('div');
            graphContainer.className = 'graph-container';
            graphContainer.id = `graph-${Date.now()}-${index}`;
            const canvas = document.createElement('canvas');
            graphContainer.appendChild(canvas);

            // Replace placeholder text
            container.innerHTML = container.innerHTML.replace(placeholder, graphContainer.outerHTML);

            // Now render the graph
            setTimeout(() => {
                const actualContainer = element.querySelector(`#graph-${graphContainer.id.split('-')[1]}-${index}`) ||
                                       element.querySelectorAll('.graph-container')[index];
                if (actualContainer) {
                    renderGraph(actualContainer.querySelector('canvas'), graphData);
                }
            }, 100);
        }
    });

    // Add click handlers for images
    container.querySelectorAll('.question-image').forEach(img => {
        img.addEventListener('click', () => openLightbox(img.src));
    });
}

/**
 * Escape HTML but preserve math delimiters and special syntax
 */
function escapeHtmlForRichContent(text) {
    if (typeof text !== 'string') return String(text || '');

    // First, convert simple math syntax to LaTeX
    text = convertSimpleMathToLatex(text);

    // Don't escape math delimiters
    const mathBlocks = [];

    // Preserve display math $$...$$
    text = text.replace(/\$\$([^$]+)\$\$/g, (match) => {
        mathBlocks.push(match);
        return `__MATH_${mathBlocks.length - 1}__`;
    });

    // Preserve inline math $...$
    text = text.replace(/\$([^$]+)\$/g, (match) => {
        mathBlocks.push(match);
        return `__MATH_${mathBlocks.length - 1}__`;
    });

    // Preserve \[...\] and \(...\)
    text = text.replace(/\\\[([^\]]+)\\\]/g, (match) => {
        mathBlocks.push(match);
        return `__MATH_${mathBlocks.length - 1}__`;
    });
    text = text.replace(/\\\(([^)]+)\\\)/g, (match) => {
        mathBlocks.push(match);
        return `__MATH_${mathBlocks.length - 1}__`;
    });

    // Escape HTML
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    text = text.replace(/[&<>"']/g, (m) => map[m]);

    // Restore math blocks
    mathBlocks.forEach((block, index) => {
        text = text.replace(`__MATH_${index}__`, block);
    });

    return text;
}

/**
 * Create HTML for an image
 */
function createImageHtml(url, isOption = false) {
    const maxHeight = isOption ? '150px' : '400px';
    return `
        <div class="question-image-container">
            <img src="${escapeHtml(url)}"
                 alt="Question image"
                 class="question-image"
                 style="max-height: ${maxHeight};"
                 onclick="openLightbox('${escapeHtml(url)}')"
                 onerror="this.parentElement.innerHTML='<span style=\\'color: #e74c3c;\\'>Image failed to load</span>'">
        </div>
    `;
}

/**
 * Create HTML for a table
 * Format: header1,header2|row1col1,row1col2|row2col1,row2col2
 */
function createTableHtml(tableData) {
    try {
        const rows = tableData.split('|');
        if (rows.length < 2) return `<span style="color: #e74c3c;">Invalid table format</span>`;

        const headers = rows[0].split(',').map(h => h.trim());
        let html = '<table><thead><tr>';
        headers.forEach(h => {
            html += `<th>${escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';

        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim());
            html += '<tr>';
            cells.forEach(cell => {
                html += `<td>${escapeHtml(cell)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    } catch (e) {
        console.warn('Table parsing error:', e);
        return `<span style="color: #e74c3c;">Table error</span>`;
    }
}

/**
 * Render a graph using Chart.js
 * Format: type:label1,val1;label2,val2;... or type:JSON
 */
function renderGraph(canvas, graphData) {
    if (!canvas || typeof Chart === 'undefined') {
        console.warn('Chart.js not available');
        return;
    }

    try {
        const parts = graphData.split(':');
        const type = parts[0].toLowerCase().trim();
        const dataStr = parts.slice(1).join(':');

        let chartConfig;

        // Try to parse as JSON first
        try {
            const jsonData = JSON.parse(dataStr);
            chartConfig = {
                type: type,
                data: jsonData.data || jsonData,
                options: jsonData.options || {
                    responsive: true,
                    maintainAspectRatio: true
                }
            };
        } catch {
            // Parse simple format: label1,val1;label2,val2;...
            const dataPoints = dataStr.split(';').map(point => {
                const [label, value] = point.split(',').map(s => s.trim());
                return { label, value: parseFloat(value) || 0 };
            });

            const labels = dataPoints.map(d => d.label);
            const values = dataPoints.map(d => d.value);

            const colors = [
                '#3498db', '#e74c3c', '#27ae60', '#f39c12',
                '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
            ];

            chartConfig = {
                type: type === 'pie' || type === 'doughnut' ? type : (type === 'bar' ? 'bar' : 'line'),
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Data',
                        data: values,
                        backgroundColor: type === 'pie' || type === 'doughnut'
                            ? colors.slice(0, values.length)
                            : 'rgba(52, 152, 219, 0.6)',
                        borderColor: type === 'pie' || type === 'doughnut'
                            ? colors.slice(0, values.length)
                            : '#3498db',
                        borderWidth: 2,
                        fill: type === 'line' ? false : true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: type === 'pie' || type === 'doughnut'
                        }
                    }
                }
            };
        }

        new Chart(canvas, chartConfig);
    } catch (e) {
        console.warn('Graph rendering error:', e);
        canvas.parentElement.innerHTML = `<span style="color: #e74c3c;">Graph error: ${e.message}</span>`;
    }
}

/**
 * Open image in lightbox
 */
function openLightbox(src) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close lightbox
 */
function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Helper function to render content and return HTML string
 * Used for template literals where we need HTML string
 */
function getRichContentHtml(content, isOption = false) {
    const temp = document.createElement('div');
    renderRichContent(content, temp, isOption);
    return temp.innerHTML;
}

/**
 * Process all rich content in a container after it's added to DOM
 * Call this after setting innerHTML with rich content placeholders
 */
function processRichContentInContainer(container) {
    if (!container) return;

    // Find all elements that need math rendering
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(container, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\[', right: '\\]', display: true},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false,
                strict: false
            });
        } catch (e) {
            console.warn('KaTeX rendering error:', e);
        }
    }

    // Add click handlers for images
    container.querySelectorAll('.question-image').forEach(img => {
        if (!img.dataset.lightboxBound) {
            img.addEventListener('click', () => openLightbox(img.src));
            img.dataset.lightboxBound = 'true';
        }
    });
}

// Close lightbox with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeLightbox();
    }
});

// ========== HIERARCHICAL QUESTION AUTO-DETECTION ==========
/**
 * Auto-detects hierarchical question structures and creates parent-child relationships
 * Patterns detected:
 * - "Directions (Q1-5):" or "Passage:" followed by text and multiple questions
 * - "Questions 1-3 refer to the following..."
 * - Numbered question groups with shared context
 */
function detectAndStructureHierarchicalQuestions(questions) {
    const structured = [];
    let i = 0;

    while (i < questions.length) {
        const currentQ = questions[i];
        const questionText = currentQ.question || '';

        // Check if this looks like a main question (passage, directions, scenario)
        const mainQuestionPatterns = [
            /^(?:Directions?|Passage|Read the following|Comprehension|Data|Instructions?)[\s:]/i,
            /^(?:Questions?\s+\d+\s*[-to]+\s*\d+|Q\d+\s*[-to]+\s*Q?\d+)\s*(?:refer to|are based on|relate to)/i,
            /^(?:The following|Below is|Consider the)/i
        ];

        const isMainQuestion = mainQuestionPatterns.some(pattern => pattern.test(questionText));

        if (isMainQuestion && i + 1 < questions.length) {
            // This is a main question - create parent with sub-questions
            const mainQuestionId = `MAIN_${Date.now()}_${i}`;
            
            // Extract question range if mentioned (e.g., "Q1-5" or "Questions 1 to 3")
            const rangeMatch = questionText.match(/(?:Q|Questions?)\s*(\d+)\s*[-to]+\s*(?:Q)?(\d+)/i);
            let expectedSubQuestions = rangeMatch ? parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1 : 3;
            
            // Create main question
            const mainQuestion = {
                ...currentQ,
                id: mainQuestionId,
                questionType: 'Main Question',
                mainQuestionText: questionText,
                // Main questions typically don't have options themselves
                options: ['', '', '', ''],
                correct: -1
            };

            structured.push(mainQuestion);

            // Collect sub-questions (next few questions)
            let subQuestionCount = 0;
            let j = i + 1;

            while (j < questions.length && subQuestionCount < expectedSubQuestions && subQuestionCount < 10) {
                const subQ = questions[j];
                const subQuestionText = subQ.question || '';

                // Check if this is still a sub-question or a new main question
                const looksLikeNewMainQuestion = mainQuestionPatterns.some(pattern => pattern.test(subQuestionText));
                
                if (looksLikeNewMainQuestion) {
                    break; // New main question starts
                }

                // Create sub-question
                structured.push({
                    ...subQ,
                    id: `${mainQuestionId}_SUB_${subQuestionCount + 1}`,
                    questionType: 'Sub Question',
                    parentQuestionId: mainQuestionId,
                    subQuestionNumber: subQuestionCount + 1,
                    mainQuestionText: questionText // Reference to parent text
                });

                subQuestionCount++;
                j++;
            }

            i = j; // Skip processed sub-questions
        } else {
            // Standalone question
            structured.push({
                ...currentQ,
                questionType: 'Standalone'
            });
            i++;
        }
    }

    return structured;
}

// ========== EXAM SESSION TRACKING FOR RESUME FUNCTIONALITY ==========
const EXAM_STATE_KEY = 'polite_exam_in_progress';

// Save current exam state to localStorage
function saveExamState() {
    if (!currentExam) return;

    const examState = {
        examCode: currentExam.code,
        examId: currentExam.examId,
        examTitle: currentExam.title,
        duration: currentExam.duration,
        questions: currentExam.questions,
        startTime: currentExam.startTime.toISOString(),
        currentQuestionIndex: currentQuestionIndex,
        userAnswers: userAnswers,
        timeRemaining: timeRemaining,
        candidateName: document.getElementById('candidate-name')?.value || '',
        candidateMobile: document.getElementById('candidate-mobile')?.value || '',
        savedAt: new Date().toISOString()
    };

    localStorage.setItem(EXAM_STATE_KEY, JSON.stringify(examState));
}

// Load saved exam state from localStorage
function loadExamState() {
    const savedState = localStorage.getItem(EXAM_STATE_KEY);
    if (!savedState) return null;

    try {
        const state = JSON.parse(savedState);
        // Check if exam state is not too old (max 24 hours)
        const savedAt = new Date(state.savedAt);
        const now = new Date();
        const hoursDiff = (now - savedAt) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            clearExamState();
            return null;
        }

        return state;
    } catch (e) {
        console.error('Error loading exam state:', e);
        clearExamState();
        return null;
    }
}

// Clear saved exam state
function clearExamState() {
    localStorage.removeItem(EXAM_STATE_KEY);
}

// Check and resume exam if one was in progress
function checkAndResumeExam() {
    const savedState = loadExamState();
    if (!savedState) return;

    // Check if the saved exam belongs to the current user
    const session = getSession();
    if (session && session.userData) {
        const currentEmail = session.userData.email;
        const savedName = savedState.candidateName;
        const savedMobile = savedState.candidateMobile;

        // Only resume if same user (by name and mobile)
        const currentName = session.userData.name;
        const currentMobile = session.userData.mobile;

        if (currentName !== savedName || currentMobile !== savedMobile) {
            clearExamState();
            return;
        }
    }

    // Calculate remaining time
    const startTime = new Date(savedState.startTime);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const totalDurationSeconds = savedState.duration * 60;
    const remainingSeconds = totalDurationSeconds - elapsedSeconds;

    if (remainingSeconds <= 0) {
        // Exam time expired
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('⚠️ Your previous exam has expired. Please start a new one.', 'error');
        }
        clearExamState();
        return;
    }

    // Ask user if they want to resume
    const confirmResume = confirm(
        `You have an ongoing exam: "${savedState.examTitle}"\n\n` +
        `Time remaining: ${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds\n` +
        `Questions answered: ${savedState.userAnswers.filter(a => typeof a === 'number' && a >= 0 && a <= 3).length}/${savedState.questions.length}\n\n` +
        `Do you want to resume this exam?`
    );

    if (confirmResume) {
        resumeExam(savedState, remainingSeconds);
    } else {
        // User chose not to resume, clear the state
        clearExamState();
    }
}

// Resume exam from saved state
function resumeExam(savedState, remainingSeconds) {
    // Restore exam state
    currentExam = {
        code: savedState.examCode,
        examId: savedState.examId,
        title: savedState.examTitle,
        duration: savedState.duration,
        questions: savedState.questions,
        startTime: new Date(savedState.startTime)
    };

    currentQuestionIndex = savedState.currentQuestionIndex;
    userAnswers = savedState.userAnswers;
    timeRemaining = remainingSeconds;

    // Set candidate info
    const nameInput = document.getElementById('candidate-name');
    const mobileInput = document.getElementById('candidate-mobile');
    if (nameInput) nameInput.value = savedState.candidateName;
    if (mobileInput) mobileInput.value = savedState.candidateMobile;

    // Hide other screens and show exam screen
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById('exam-screen').classList.add('active');
    updateHeaderNav('exam-screen');

    // Start timer
    startExamTimer();

    // Load current question
    loadQuestion();

    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification('✅ Exam resumed successfully!', 'success');
    }
}

// Start or restart the exam timer
function startExamTimer() {
    if (examTimer) {
        clearInterval(examTimer);
    }

    // Initial display update
    updateTimerDisplay();

    examTimer = setInterval(function() {
        timeRemaining--;

        // Update timer display - both old and new elements
        updateTimerDisplay();

        // Save state every 30 seconds
        if (timeRemaining % 30 === 0) {
            saveExamState();
        }

        // Auto-submit when time runs out
        if (timeRemaining <= 0) {
            clearInterval(examTimer);

            const notification = document.createElement('div');
            notification.className = 'notification error';
            notification.innerHTML = '⏰ Time\'s up! Submitting your exam automatically...';
            document.getElementById('notification-container').appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);

            submitExam(true);
        }
    }, 1000);
}
// ========== END EXAM SESSION TRACKING ==========

// Function to manage header navigation visibility (global scope)
function updateHeaderNav(screenId) {
    const adminLink = document.getElementById('admin-link');
    const candidateNavButtons = document.getElementById('candidate-nav-buttons');
    const backBtn = document.getElementById('header-back-btn');
    const headerLogoutBtn = document.getElementById('header-logout-btn');

    if (!adminLink || !candidateNavButtons || !backBtn) return; // Guard for early calls

    // Screens where admin link should be hidden and candidate nav shown
    const candidateScreens = ['candidate-signup-screen', 'candidate-signin-screen', 'candidate-dashboard',
                              'candidate-login-screen', 'exam-screen', 'result-screen', 'forgot-password-screen'];

    // Screens where admin link should be hidden (admin panel and login screen)
    const adminScreens = ['admin-panel', 'admin-login-screen'];

    // Screens where back button should be hidden (root screens)
    const noBackScreens = ['hero-landing', 'candidate-dashboard'];

    // Screens where header logout should be hidden (dashboard has its own logout)
    const noHeaderLogoutScreens = ['candidate-dashboard'];

    if (candidateScreens.includes(screenId)) {
        adminLink.classList.add('hidden');
        candidateNavButtons.classList.add('visible');

        // Hide back button on dashboard (root screen for logged in users)
        if (noBackScreens.includes(screenId)) {
            backBtn.style.display = 'none';
        } else {
            backBtn.style.display = 'block';
        }

        // Hide header logout button on dashboard (it has its own logout link)
        if (headerLogoutBtn) {
            if (noHeaderLogoutScreens.includes(screenId)) {
                headerLogoutBtn.style.display = 'none';
            } else {
                headerLogoutBtn.style.display = 'block';
            }
        }
    } else if (adminScreens.includes(screenId)) {
        // Hide admin link on admin panel and login screen
        adminLink.classList.add('hidden');
        candidateNavButtons.classList.remove('visible');
    } else {
        adminLink.classList.remove('hidden');
        candidateNavButtons.classList.remove('visible');
    }

    currentScreen = screenId;
}

// Sample data
questions = [
    {
        ID: "Q1",
        Subject: "Math",
        Question: "What is 5 × 6?",
        'Option A': "25",
        'Option B': "30",
        'Option C': "35",
        'Option D': "40",
        Correct: "B"
    },
    {
        ID: "Q2",
        Subject: "Reasoning",
        Question: "2, 4, 8, 16, ?",
        'Option A': "20",
        'Option B': "24",
        'Option C': "32",
        'Option D': "64",
        Correct: "C"
    },
    {
        ID: "Q3",
        Subject: "GK",
        Question: "Who is the current Prime Minister of India?",
        'Option A': "Narendra Modi",
        'Option B': "Manmohan Singh",
        'Option C': "Rahul Gandhi",
        'Option D': "Amit Shah",
        Correct: "A"
    },
    {
        ID: "Q4",
        Subject: "Math",
        Question: "If a shirt costs ₹800 after a 20% discount, what was its original price?",
        'Option A': "₹900",
        'Option B': "₹960",
        'Option C': "₹1000",
        'Option D': "₹1200",
        Correct: "C"
    },
    {
        ID: "Q5",
        Subject: "Reasoning",
        Question: "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies. Is this statement true?",
        'Option A': "True",
        'Option B': "False",
        'Option C': "Cannot be determined",
        'Option D': "Only sometimes",
        Correct: "A"
    }
];

exams = [
    {
        'Exam Code': "SAMPLE01",
        'Title': "Sample Reasoning & Math Test",
        'Duration (mins)': "10",
        'Expiry (IST)': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + 'Z',
        'Question IDs': "Q1,Q2,Q3,Q4,Q5"
    }
];

// Session Management
// Candidates use sessionStorage (auto-logout on browser close)
// Admins use localStorage (persist across sessions)
// Exam progress stays in localStorage (allows resume after re-login)
function saveSession(userType, userData) {
    if (userType === 'candidate') {
        // Use sessionStorage for candidates - clears when browser closes
        sessionStorage.setItem('userType', userType);
        sessionStorage.setItem('userData', JSON.stringify(userData));
    } else {
        // Use localStorage for admin - persists across sessions
        localStorage.setItem('userType', userType);
        localStorage.setItem('userData', JSON.stringify(userData));
    }
}

function getSession() {
    // Check sessionStorage first (for candidates)
    let userType = sessionStorage.getItem('userType');
    let userData = sessionStorage.getItem('userData');

    // If not in sessionStorage, check localStorage (for admin)
    if (!userType || !userData) {
        userType = localStorage.getItem('userType');
        userData = localStorage.getItem('userData');
    }

    return userType && userData ? { userType, userData: JSON.parse(userData) } : null;
}

function clearSession() {
    // Clear both storage types to ensure complete logout
    sessionStorage.removeItem('userType');
    sessionStorage.removeItem('userData');
    localStorage.removeItem('userType');
    localStorage.removeItem('userData');
}

// Helper function to format date correctly (handles YYYY-MM-DD as local date)
function formatDateForDisplay(dateInput) {
    if (!dateInput) return 'N/A';

    let date;
    const dateStr = String(dateInput);

    // Check if date is in YYYY-MM-DD format (parse as local, not UTC)
    const yyyymmddMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1], 10);
        const month = parseInt(yyyymmddMatch[2], 10) - 1;
        const day = parseInt(yyyymmddMatch[3], 10);
        date = new Date(year, month, day);
    } else {
        // Try parsing as-is for other formats
        date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) return 'Invalid Date';

    // Format as dd-mm-yyyy
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// OCR Review Modal Functions
function openOCRReviewModal(questions) {
    const modal = document.getElementById('ocr-review-modal');
    const container = document.getElementById('ocr-review-questions');

    // Count hierarchical summary
    const passages = questions.filter(q => q.questionType === 'Main Question').length;
    const subQs = questions.filter(q => q.questionType === 'Sub Question').length;
    const standalone = questions.filter(q => q.questionType === 'Standalone' || !q.questionType).length;

    // Build list of available parent questions for dropdown
    const parentOptions = questions
        .map((q, idx) => ({ index: idx, id: q.id, text: q.question?.substring(0, 50) + '...', type: q.questionType }))
        .filter(q => q.type === 'Main Question');

    let html = '';

    // Add summary header and editing instructions
    html += `
        <div style="background: linear-gradient(135deg, #2196f3, #1976d2); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
            <h4 style="margin: 0 0 10px 0;">✏️ Review & Edit Question Structure</h4>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.95;">
                AI has analyzed the text. You can now <strong>edit question types</strong> and <strong>assign parent-child relationships</strong> if the AI detection was incorrect.
            </p>
        </div>
    `;

    // Summary stats
    html += `
        <div style="background: linear-gradient(135deg, #9c27b0, #7b1fa2); color: white; padding: 12px 15px; border-radius: 10px; margin-bottom: 20px;">
            <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <span style="font-weight: 600;">Current Structure:</span>
                <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px;">📖 ${passages} Passage(s)</span>
                <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px;">📝 ${subQs} Child Question(s)</span>
                <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px;">✅ ${standalone} Standalone</span>
            </div>
        </div>
    `;

    questions.forEach((q, index) => {
        const questionType = q.questionType || 'Standalone';
        const isPassage = questionType === 'Main Question';
        const isSubQuestion = questionType === 'Sub Question';

        // Initial styling based on question type
        const cardStyle = isPassage ? 'background: #fff3e0; border-left: 4px solid #ff9800;' :
                          isSubQuestion ? 'background: #f3e5f5; border-left: 4px solid #9c27b0; margin-left: 30px;' :
                          'background: #f8f9fa; border-left: 4px solid var(--secondary);';

        // Build parent options dropdown HTML
        let parentDropdownOptions = '<option value="">-- Select Parent Passage --</option>';
        parentOptions.forEach(p => {
            if (p.index !== index) { // Don't allow self-selection
                const selected = q.parentQuestionId === p.id ? 'selected' : '';
                parentDropdownOptions += `<option value="${p.id}" ${selected}>Q${p.index + 1}: ${p.text}</option>`;
            }
        });

        html += `
            <div class="ocr-question-card" id="ocr-card-${index}" data-index="${index}" data-question-type="${questionType}" data-parent-id="${q.parentQuestionId || ''}" style="${cardStyle} border-radius: 10px; padding: 15px; margin-bottom: 12px; transition: all 0.3s ease;">
                <div class="ocr-question-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="ocr-question-number" style="font-weight: 700; font-size: 1.1rem;">Q${index + 1}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <!-- Question Type Selector -->
                        <select id="ocr-type-${index}" onchange="updateOCRQuestionType(${index})" style="padding: 6px 12px; border-radius: 5px; border: 2px solid #666; font-weight: 600; cursor: pointer;">
                            <option value="Standalone" ${questionType === 'Standalone' ? 'selected' : ''}>✅ Standalone</option>
                            <option value="Main Question" ${questionType === 'Main Question' ? 'selected' : ''}>📖 Parent (Passage)</option>
                            <option value="Sub Question" ${questionType === 'Sub Question' ? 'selected' : ''}>📝 Child Question</option>
                        </select>
                        <button class="ocr-delete-btn" onclick="deleteOCRQuestion(${index})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">🗑️</button>
                    </div>
                </div>

                <!-- Parent Selection (only for Child questions) -->
                <div id="ocr-parent-select-${index}" class="ocr-form-group" style="margin-bottom: 10px; display: ${isSubQuestion ? 'block' : 'none'}; background: #e1bee7; padding: 10px; border-radius: 8px;">
                    <label style="font-weight: 600; margin-bottom: 5px; display: block; color: #7b1fa2;">🔗 Link to Parent Passage:</label>
                    <select id="ocr-parent-${index}" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #9c27b0;">
                        ${parentDropdownOptions}
                    </select>
                    <small style="color: #666; display: block; margin-top: 5px;">Select which passage this child question belongs to</small>
                </div>

                <div class="ocr-form-group" style="margin-bottom: 10px;">
                    <label style="font-weight: 600; margin-bottom: 5px; display: block;">Subject Category</label>
                    <select id="ocr-subject-${index}" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
                        <option value="Quantitative Aptitude" ${q.subject === 'Quantitative Aptitude' || q.subject === 'Math' ? 'selected' : ''}>Quantitative Aptitude</option>
                        <option value="Reasoning Ability" ${q.subject === 'Reasoning Ability' || q.subject === 'Reasoning' ? 'selected' : ''}>Reasoning Ability</option>
                        <option value="English Language" ${q.subject === 'English Language' || q.subject === 'English' ? 'selected' : ''}>English Language</option>
                        <option value="General Awareness" ${q.subject === 'General Awareness' || q.subject === 'GK' ? 'selected' : ''}>General Awareness</option>
                        <option value="Current Affairs" ${q.subject === 'Current Affairs' ? 'selected' : ''}>Current Affairs</option>
                        <option value="Banking Awareness" ${q.subject === 'Banking Awareness' ? 'selected' : ''}>Banking Awareness</option>
                        <option value="Computer Knowledge" ${q.subject === 'Computer Knowledge' ? 'selected' : ''}>Computer Knowledge</option>
                        <option value="Data Interpretation" ${q.subject === 'Data Interpretation' ? 'selected' : ''}>Data Interpretation</option>
                        <option value="Others" ${q.subject === 'Others' ? 'selected' : ''}>Others</option>
                    </select>
                </div>

                <div class="ocr-form-group" style="margin-bottom: 10px;">
                    <label id="ocr-text-label-${index}" style="font-weight: 600; margin-bottom: 5px; display: block;">${isPassage ? 'Passage/Comprehension Text' : 'Question Text'}</label>
                    <textarea id="ocr-question-${index}" rows="${isPassage ? 4 : 2}" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ddd; resize: vertical;">${q.question || ''}</textarea>
                </div>

                <!-- Options section (hidden for passages) -->
                <div id="ocr-options-section-${index}" style="display: ${isPassage ? 'none' : 'block'};">
                    <div class="ocr-form-group" style="margin-bottom: 10px;">
                        <label style="font-weight: 600; margin-bottom: 5px; display: block;">Options</label>
                        <div class="ocr-options-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="ocr-option-group">
                                <label style="font-weight: 500;">A:</label>
                                <input type="text" id="ocr-optionA-${index}" value="${q.options ? q.options[0] || '' : ''}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ddd;">
                            </div>
                            <div class="ocr-option-group">
                                <label style="font-weight: 500;">B:</label>
                                <input type="text" id="ocr-optionB-${index}" value="${q.options ? q.options[1] || '' : ''}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ddd;">
                            </div>
                            <div class="ocr-option-group">
                                <label style="font-weight: 500;">C:</label>
                                <input type="text" id="ocr-optionC-${index}" value="${q.options ? q.options[2] || '' : ''}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ddd;">
                            </div>
                            <div class="ocr-option-group">
                                <label style="font-weight: 500;">D:</label>
                                <input type="text" id="ocr-optionD-${index}" value="${q.options ? q.options[3] || '' : ''}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ddd;">
                            </div>
                        </div>
                    </div>
                    <div class="ocr-correct-answer" style="display: flex; align-items: center; gap: 10px;">
                        <label style="font-weight: 600;">✓ Correct Answer:</label>
                        <select id="ocr-correct-${index}" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ddd;">
                            <option value="0" ${q.correct === 0 ? 'selected' : ''}>A</option>
                            <option value="1" ${q.correct === 1 ? 'selected' : ''}>B</option>
                            <option value="2" ${q.correct === 2 ? 'selected' : ''}>C</option>
                            <option value="3" ${q.correct === 3 ? 'selected' : ''}>D</option>
                        </select>
                    </div>
                </div>

                <!-- Passage info (shown only for passages) -->
                <div id="ocr-passage-info-${index}" style="display: ${isPassage ? 'block' : 'none'}; color: #ff9800; font-weight: 500; margin-top: 10px; padding: 10px; background: #fff8e1; border-radius: 8px;">
                    📖 This is a parent passage - no marks. Add child questions below that reference this passage.
                </div>
            </div>`;
    });

    container.innerHTML = html;
    modal.style.display = 'block';
}

// Handle question type change in OCR review modal
function updateOCRQuestionType(index) {
    const typeSelect = document.getElementById(`ocr-type-${index}`);
    const card = document.getElementById(`ocr-card-${index}`);
    const parentSelect = document.getElementById(`ocr-parent-select-${index}`);
    const optionsSection = document.getElementById(`ocr-options-section-${index}`);
    const passageInfo = document.getElementById(`ocr-passage-info-${index}`);
    const textLabel = document.getElementById(`ocr-text-label-${index}`);
    const questionTextarea = document.getElementById(`ocr-question-${index}`);

    const newType = typeSelect.value;

    // Update card styling based on type
    if (newType === 'Main Question') {
        card.style.background = '#fff3e0';
        card.style.borderLeft = '4px solid #ff9800';
        card.style.marginLeft = '0';
        parentSelect.style.display = 'none';
        optionsSection.style.display = 'none';
        passageInfo.style.display = 'block';
        textLabel.textContent = 'Passage/Comprehension Text';
        questionTextarea.rows = 4;
    } else if (newType === 'Sub Question') {
        card.style.background = '#f3e5f5';
        card.style.borderLeft = '4px solid #9c27b0';
        card.style.marginLeft = '30px';
        parentSelect.style.display = 'block';
        optionsSection.style.display = 'block';
        passageInfo.style.display = 'none';
        textLabel.textContent = 'Question Text';
        questionTextarea.rows = 2;
    } else {
        // Standalone
        card.style.background = '#f8f9fa';
        card.style.borderLeft = '4px solid var(--secondary)';
        card.style.marginLeft = '0';
        parentSelect.style.display = 'none';
        optionsSection.style.display = 'block';
        passageInfo.style.display = 'none';
        textLabel.textContent = 'Question Text';
        questionTextarea.rows = 2;
    }

    // Update data attribute
    card.setAttribute('data-question-type', newType);

    // Always update parent dropdown options when any type changes
    // This ensures child dropdowns get updated when a new parent is created
    updateParentDropdownOptions();
}

// Update all parent dropdown options when a question type changes
function updateParentDropdownOptions() {
    const allCards = document.querySelectorAll('.ocr-question-card');
    const parentOptions = [];

    // First, collect all current parent passages
    allCards.forEach((card, idx) => {
        const typeSelect = document.getElementById(`ocr-type-${idx}`);
        if (typeSelect && typeSelect.value === 'Main Question') {
            const questionText = document.getElementById(`ocr-question-${idx}`)?.value || '';
            parentOptions.push({
                index: idx,
                id: extractedQuestions[idx]?.id || `Q${idx}`,
                text: questionText.substring(0, 50) + (questionText.length > 50 ? '...' : '')
            });
        }
    });

    // Update all parent dropdowns
    allCards.forEach((card, idx) => {
        const parentDropdown = document.getElementById(`ocr-parent-${idx}`);
        if (parentDropdown) {
            const currentValue = parentDropdown.value;
            let optionsHtml = '<option value="">-- Select Parent Passage --</option>';
            parentOptions.forEach(p => {
                if (p.index !== idx) {
                    const selected = currentValue === p.id ? 'selected' : '';
                    optionsHtml += `<option value="${p.id}" ${selected}>Q${p.index + 1}: ${p.text}</option>`;
                }
            });
            parentDropdown.innerHTML = optionsHtml;
        }
    });
}

function deleteOCRQuestion(index) {
    extractedQuestions.splice(index, 1);
    if (extractedQuestions.length === 0) {
        closeOCRReviewModal();
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ All questions deleted. Please upload again.', 'error');
        }
    } else {
        openOCRReviewModal(extractedQuestions);
    }
}

function closeOCRReviewModal() {
    document.getElementById('ocr-review-modal').style.display = 'none';

    // If modal was closed without saving, go back to step 1
    if (document.getElementById('upload-step-2') && !document.getElementById('upload-step-2').classList.contains('hidden')) {
        document.getElementById('upload-step-2').classList.add('hidden');
        document.getElementById('upload-step-1').classList.remove('hidden');
    }
}

function saveOCRReviewedQuestions() {
    // Collect all edited values from the modal
    const questionCards = document.querySelectorAll('.ocr-question-card');
    const updatedQuestions = [];
    const passageIdMap = new Map(); // Map original index to new ID for passages
    const indexToNewIdMap = new Map(); // Map index to new ID

    // First pass: Collect all questions, read type from DROPDOWN (not attribute)
    const timestamp = Date.now();
    questionCards.forEach((card, index) => {
        // Read the type from the dropdown selector (which admin may have changed)
        const typeSelect = document.getElementById(`ocr-type-${index}`);
        const questionType = typeSelect ? typeSelect.value : (card.getAttribute('data-question-type') || 'Standalone');

        // Read parent selection from dropdown (for child questions)
        const parentDropdown = document.getElementById(`ocr-parent-${index}`);
        const selectedParentId = parentDropdown ? parentDropdown.value : '';

        const subject = document.getElementById(`ocr-subject-${index}`).value;
        const question = document.getElementById(`ocr-question-${index}`).value.trim();
        const optionA = document.getElementById(`ocr-optionA-${index}`)?.value?.trim() || '';
        const optionB = document.getElementById(`ocr-optionB-${index}`)?.value?.trim() || '';
        const optionC = document.getElementById(`ocr-optionC-${index}`)?.value?.trim() || '';
        const optionD = document.getElementById(`ocr-optionD-${index}`)?.value?.trim() || '';
        const correct = parseInt(document.getElementById(`ocr-correct-${index}`)?.value || '-1');

        if (question) {
            const isPassage = questionType === 'Main Question';
            const isSubQuestion = questionType === 'Sub Question';
            const newId = isPassage ? `PASSAGE_${timestamp}_${index}` : `Q${timestamp}_${index}`;

            // Map original index to new ID (for parent resolution)
            indexToNewIdMap.set(index, newId);

            // Map old passage ID to new one (for backward compatibility)
            if (isPassage) {
                if (extractedQuestions[index]) {
                    passageIdMap.set(extractedQuestions[index].id, newId);
                }
                passageIdMap.set(index.toString(), newId); // Also map by index
            }

            updatedQuestions.push({
                id: newId,
                originalIndex: index,
                subject: subject,
                question: question,
                options: isPassage ? ['', '', '', ''] : [optionA, optionB, optionC, optionD],
                correct: isPassage ? -1 : correct,
                questionType: questionType,
                parentQuestionId: isSubQuestion ? selectedParentId : null,
                subQuestionNumber: null, // Will be calculated in second pass
                mainQuestionText: null // Will be filled in second pass
            });
        }
    });

    // Second pass: Update parent IDs and assign sub-question numbers
    const parentChildCount = new Map(); // Track child count per parent

    updatedQuestions.forEach((q, idx) => {
        if (q.questionType === 'Sub Question' && q.parentQuestionId) {
            // Try to resolve parent ID
            let resolvedParentId = q.parentQuestionId;

            // Check if it's an index-based reference (from dropdown using Q1, Q2 format)
            const indexMatch = q.parentQuestionId.match(/^Q?(\d+)$/);
            if (indexMatch) {
                const parentIndex = parseInt(indexMatch[1]) - 1; // Q1 = index 0
                if (indexToNewIdMap.has(parentIndex)) {
                    resolvedParentId = indexToNewIdMap.get(parentIndex);
                }
            }

            // Check if it's an old ID that needs mapping
            if (passageIdMap.has(q.parentQuestionId)) {
                resolvedParentId = passageIdMap.get(q.parentQuestionId);
            }

            q.parentQuestionId = resolvedParentId;

            // Find the parent and get its question text
            const parent = updatedQuestions.find(p => p.id === resolvedParentId);
            if (parent) {
                q.mainQuestionText = parent.question;

                // Calculate sub-question number within this parent
                const count = (parentChildCount.get(resolvedParentId) || 0) + 1;
                parentChildCount.set(resolvedParentId, count);
                q.subQuestionNumber = count;
            }
        }
    });

    // Clean up temporary field
    updatedQuestions.forEach(q => delete q.originalIndex);

    if (updatedQuestions.length === 0) {
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ No valid questions to save.', 'error');
        }
        return;
    }

    // Validate: Check if any child questions don't have a parent assigned
    const orphanChildren = updatedQuestions.filter(q =>
        q.questionType === 'Sub Question' && !q.parentQuestionId
    );

    if (orphanChildren.length > 0) {
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`⚠️ ${orphanChildren.length} child question(s) have no parent assigned. Please select a parent passage for all child questions.`, 'warning');
        }
        return;
    }

    // Update the global extractedQuestions array
    extractedQuestions = updatedQuestions;

    // Close modal
    document.getElementById('ocr-review-modal').style.display = 'none';

    // Show step 3 (Review and Select Questions)
    document.getElementById('upload-step-2').classList.add('hidden');
    document.getElementById('upload-step-3').classList.remove('hidden');

    // Display the questions in ready-questions area
    displayReadyQuestions(extractedQuestions);

    // Generate summary message
    const passages = updatedQuestions.filter(q => q.questionType === 'Main Question').length;
    const subQs = updatedQuestions.filter(q => q.questionType === 'Sub Question').length;
    const standalone = updatedQuestions.filter(q => q.questionType === 'Standalone').length;
    let message = `✅ ${updatedQuestions.length} questions reviewed and ready to add!`;
    if (passages > 0) {
        message = `✅ ${updatedQuestions.length} questions ready! (${passages} passage(s), ${subQs} child question(s), ${standalone} standalone)`;
    }

    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification(message, 'success');
    }
}

function displayReadyQuestions(questions) {
    const readyQuestions = document.getElementById('ready-questions');

    if (!readyQuestions) return;

    // Count hierarchical summary
    const passages = questions.filter(q => q.questionType === 'Main Question').length;
    const subQs = questions.filter(q => q.questionType === 'Sub Question').length;

    let html = '<div style="max-height: 400px; overflow-y: auto;">';

    // Add summary if hierarchical questions present
    if (passages > 0) {
        html += `
            <div style="background: linear-gradient(135deg, #9c27b0, #7b1fa2); color: white; padding: 12px; border-radius: 10px; margin-bottom: 15px;">
                <strong>📋 Hierarchical Structure Detected:</strong> ${passages} passage(s) with ${subQs} sub-question(s)
            </div>
        `;
    }

    questions.forEach((q, index) => {
        const isPassage = q.questionType === 'Main Question';
        const isSubQuestion = q.questionType === 'Sub Question';

        // Styling based on question type
        const bgColor = isPassage ? '#fff3e0' : isSubQuestion ? '#f3e5f5' : '#f8f9fa';
        const borderColor = isPassage ? '#ff9800' : isSubQuestion ? '#9c27b0' : 'var(--secondary)';
        const marginLeft = isSubQuestion ? 'margin-left: 25px;' : '';

        const typeLabel = isPassage ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-right: 8px;">📖 Passage</span>' :
                          isSubQuestion ? `<span style="background: #9c27b0; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-right: 8px;">📝 Sub-Q #${q.subQuestionNumber || '?'}</span>` : '';

        html += `
            <label class="extracted-question-item" data-question-type="${q.questionType || 'Standalone'}" style="display: flex; align-items: flex-start; background: ${bgColor}; border-radius: 10px; padding: 15px; margin-bottom: 12px; border-left: 3px solid ${borderColor}; cursor: pointer; transition: all 0.2s; ${marginLeft}">
                <input type="checkbox" class="extracted-question-checkbox" value="${index}" checked style="margin-right: 12px; margin-top: 4px; width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; flex-wrap: wrap; margin-bottom: 8px; gap: 8px;">
                        ${typeLabel}
                        <span class="question-tag" style="background: var(--secondary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${q.subject}</span>
                    </div>
                    <p class="rich-content" style="margin-bottom: 10px; font-weight: 500;">${escapeHtmlForRichContent(q.question)}</p>`;

        // Only show options for non-passage questions
        if (!isPassage) {
            html += `
                    <div style="margin-left: 25px; margin-bottom: 8px;">
                        <div class="rich-content">A) ${escapeHtmlForRichContent(q.options ? q.options[0] : '')}</div>
                        <div class="rich-content">B) ${escapeHtmlForRichContent(q.options ? q.options[1] : '')}</div>
                        <div class="rich-content">C) ${escapeHtmlForRichContent(q.options ? q.options[2] : '')}</div>
                        <div class="rich-content">D) ${escapeHtmlForRichContent(q.options ? q.options[3] : '')}</div>
                    </div>
                    <div style="color: var(--success); font-weight: 500;">
                        ✓ Correct Answer: ${q.correct >= 0 ? String.fromCharCode(65 + q.correct) : 'N/A'}
                    </div>`;
        } else {
            html += `
                    <div style="color: #ff9800; font-weight: 500; margin-top: 5px;">
                        📖 Reference passage - No marks (marks in sub-questions)
                    </div>`;
        }

        html += `
                </div>
            </label>
        `;
    });
    html += '</div>';
    readyQuestions.innerHTML = html;

    // Process rich content (render math expressions) in OCR review
    processRichContentInContainer(readyQuestions);

    // Add hover effects with type-aware colors
    document.querySelectorAll('.extracted-question-item').forEach(item => {
        const originalBg = item.style.background;
        item.addEventListener('mouseenter', function() {
            const qType = this.getAttribute('data-question-type');
            this.style.background = qType === 'Main Question' ? '#ffe0b2' :
                                   qType === 'Sub Question' ? '#e1bee7' : '#e8f4fd';
        });
        item.addEventListener('mouseleave', function() {
            this.style.background = originalBg;
        });
    });
}

// Wait for DOM to be ready before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check app version and clear ALL data if version changed (new deployment)
    (function checkAppVersion() {
        const storedVersion = localStorage.getItem(APP_VERSION_KEY);
        const reloadFlag = sessionStorage.getItem('version_reload_done');

        if (storedVersion !== APP_VERSION && !reloadFlag) {
            console.log(`🔄 App version changed: ${storedVersion} -> ${APP_VERSION}. Clearing all cached data and reloading...`);

            // Set reload flag to prevent infinite loops
            sessionStorage.setItem('version_reload_done', 'true');

            // Clear ALL localStorage (including user sessions)
            localStorage.clear();

            // Clear Cache API completely
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                        console.log('✓ Cleared cache:', name);
                    });
                }).then(() => {
                    // Store new version
                    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
                    console.log('✓ All caches cleared. Forcing hard reload...');

                    // Force hard reload to get fresh files
                    window.location.reload(true);
                });
            } else {
                // Store new version
                localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
                console.log('✓ Cache cleared. Forcing hard reload...');

                // Force hard reload
                window.location.reload(true);
            }
        } else if (storedVersion !== APP_VERSION && reloadFlag) {
            // After reload, clear the flag and store version
            sessionStorage.removeItem('version_reload_done');
            localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
            console.log('✅ App updated to version', APP_VERSION);
        }
    })();

    // Clear temporary caches on page load for fresh data
    (async function clearCachesOnLoad() {
        try {
            // Clear Cache API if available (only dynamic/API caches)
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    // Only clear API/data caches, not static asset caches
                    if (name.includes('api') || name.includes('data') || name.includes('dynamic')) {
                        await caches.delete(name);
                        console.log('Cleared cache:', name);
                    }
                }
            }

            // Clear sessionStorage for fresh session (keep localStorage for session persistence)
            sessionStorage.clear();

            // Clear any localStorage cache flags (keep user settings and exam state)
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('cache') || key.includes('questions_') || key.includes('temp_'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            console.log('Page caches cleared for fresh data');
        } catch (e) {
            console.warn('Cache clearing error (non-fatal):', e);
        }
    })();

    // Initialize header navigation first
    updateHeaderNav('hero-landing');

    // Check for email verification token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify');

    if (verifyToken) {
        // Remove the query parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Verify the email
        (async function() {
            try {
                const result = await window.PoliteCCAPI.verifyEmail(verifyToken);
                if (result && result.success) {
                    // Show verification success screen
                    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                    document.getElementById('verification-success-screen').classList.add('active');
                }
            } catch (error) {
                console.error('Verification error:', error);
                window.PoliteCCAPI.showNotification('Verification failed. Please try again.', 'error');
            }
        })();
    }

    // Verification success - go to signin handler
    document.getElementById('goto-signin-after-verify').addEventListener('click', function() {
        document.getElementById('verification-success-screen').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
    });

    // Verification pending - resend verification handler
    document.getElementById('resend-verification-btn').addEventListener('click', async function() {
        const email = document.getElementById('pending-verification-email').textContent;
        if (email) {
            this.disabled = true;
            this.textContent = 'Sending...';
            await window.PoliteCCAPI.resendVerification(email);
            this.disabled = false;
            this.textContent = 'Resend Verification Email';
        }
    });

    // Verification pending - go to signin handler
    document.getElementById('goto-signin-from-pending').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('verification-pending-screen').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
    });

    // Header Back Button Handler
    document.getElementById('header-back-btn').addEventListener('click', function() {
        const currentScreenId = currentScreen;

        // Define back navigation mapping
        const backMap = {
            'candidate-signup-screen': 'hero-landing',
            'candidate-signin-screen': 'hero-landing',
            'forgot-password-screen': 'candidate-signin-screen',
            'candidate-login-screen': 'candidate-dashboard',
            'exam-screen': 'candidate-login-screen',
            'result-screen': 'candidate-dashboard',
            'verification-pending-screen': 'candidate-signin-screen',
            'verification-success-screen': 'candidate-signin-screen'
        };

        const targetScreen = backMap[currentScreenId] || 'hero-landing';

        // Navigate to target screen
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(targetScreen).classList.add('active');
        updateHeaderNav(targetScreen);
    });

    // Header Logout Button Handler
    document.getElementById('header-logout-btn').addEventListener('click', function() {
        // Clear any active timers
        if (examTimer) {
            clearInterval(examTimer);
            examTimer = null;
        }

        // Clear session
        clearSession();

        // Reset state
        currentExam = null;
        currentQuestionIndex = 0;
        userAnswers = [];

        // Navigate to hero landing
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('hero-landing').classList.add('active');
        updateHeaderNav('hero-landing');

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('✅ Logged out successfully', 'success');
        }
    });

    // OCR Review Modal Event Handlers
    document.getElementById('ocr-review-close').addEventListener('click', closeOCRReviewModal);
    document.getElementById('ocr-cancel-review').addEventListener('click', closeOCRReviewModal);
    document.getElementById('ocr-save-reviewed').addEventListener('click', saveOCRReviewedQuestions);

    // Mobile Navigation Handlers
    const mobileHomeLink = document.getElementById('mobile-home-link');
    if (mobileHomeLink) {
        mobileHomeLink.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear any active timers
            if (examTimer) {
                clearInterval(examTimer);
                examTimer = null;
            }
            // Clear session
            clearSession();
            // Navigate to hero landing
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('hero-landing').classList.add('active');
            updateHeaderNav('hero-landing');
            // Close mobile menu drawer if open
            const mobileDrawer = document.getElementById('mobile-menu-drawer');
            if (mobileDrawer) mobileDrawer.checked = false;
        });
    }

    const mobileAdminLink = document.getElementById('mobile-admin-link');
    if (mobileAdminLink) {
        mobileAdminLink.addEventListener('click', function(e) {
            e.preventDefault();
            // Navigate to admin login
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('admin-login-screen').classList.add('active');
            updateHeaderNav('admin-login-screen');
            // Close mobile menu drawer if open
            const mobileDrawer = document.getElementById('mobile-menu-drawer');
            if (mobileDrawer) mobileDrawer.checked = false;
        });
    }

    // Navigation: Hero Landing <-> Signup
    document.getElementById('signup-btn').addEventListener('click', function() {
        document.getElementById('hero-landing').classList.remove('active');
        document.getElementById('candidate-signup-screen').classList.add('active');
        updateHeaderNav('candidate-signup-screen');
    });

    document.getElementById('back-to-hero-from-signup').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('candidate-signup-screen').classList.remove('active');
        document.getElementById('hero-landing').classList.add('active');
        updateHeaderNav('hero-landing');
    });

    // Navigation: Hero Landing <-> Signin
    document.getElementById('signin-btn').addEventListener('click', function() {
        document.getElementById('hero-landing').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
        updateHeaderNav('candidate-signin-screen');
    });

    document.getElementById('back-to-hero-from-signin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('candidate-signin-screen').classList.remove('active');
        document.getElementById('hero-landing').classList.add('active');
        updateHeaderNav('hero-landing');
    });

    // Navigation: Signup <-> Signin
    document.getElementById('goto-signin-link').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('candidate-signup-screen').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
        updateHeaderNav('candidate-signin-screen');
    });

    document.getElementById('goto-signup-link').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('candidate-signin-screen').classList.remove('active');
        document.getElementById('candidate-signup-screen').classList.add('active');
        updateHeaderNav('candidate-signup-screen');
    });

    // Navigation: Signin <-> Forgot Password
    document.getElementById('forgot-password-link').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('candidate-signin-screen').classList.remove('active');
        document.getElementById('forgot-password-screen').classList.add('active');
        updateHeaderNav('forgot-password-screen');
        // Reset the form
        document.getElementById('forgot-email').value = '';
        document.getElementById('reset-result').style.display = 'none';
    });

    document.getElementById('back-to-signin-from-forgot').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('forgot-password-screen').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
        updateHeaderNav('candidate-signin-screen');
    });

    document.getElementById('goto-signin-after-reset').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('forgot-password-screen').classList.remove('active');
        document.getElementById('candidate-signin-screen').classList.add('active');
        updateHeaderNav('candidate-signin-screen');
    });

    // Navigation: Hero Landing <-> Admin Login
    document.getElementById('admin-link').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('hero-landing').classList.remove('active');
        document.getElementById('admin-login-screen').classList.add('active');
    });

    document.getElementById('back-to-hero-from-admin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('admin-login-screen').classList.remove('active');
        document.getElementById('hero-landing').classList.add('active');
    });

// Candidate Signup
document.getElementById('signup-submit-btn').addEventListener('click', async function() {
    try {
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const mobile = document.getElementById('signup-mobile').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        // Validation - mobile is now optional
        if (!name || !email || !password || !confirmPassword) {
            window.PoliteCCAPI.showNotification('Please fill all required fields', 'error');
            return;
        }

        // Validate mobile only if provided
        if (mobile && (mobile.length !== 10 || isNaN(mobile))) {
            window.PoliteCCAPI.showNotification('Please enter a valid 10-digit mobile number', 'error');
            return;
        }

        if (password !== confirmPassword) {
            window.PoliteCCAPI.showNotification('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            window.PoliteCCAPI.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        // Call API to create account
        const result = await window.PoliteCCAPI.candidateSignup({ name, email, mobile, password });

        if (result) {
            // Clear form
            document.getElementById('signup-name').value = '';
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-mobile').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-confirm-password').value = '';

            // Show verification pending screen
            document.getElementById('pending-verification-email').textContent = email;
            document.getElementById('candidate-signup-screen').classList.remove('active');
            document.getElementById('verification-pending-screen').classList.add('active');
        }
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Candidate Login
document.getElementById('signin-submit-btn').addEventListener('click', async function() {
    try {
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;

        if (!email || !password) {
            window.PoliteCCAPI.showNotification('Please fill all fields', 'error');
            return;
        }

        // Call API directly to check for verification requirement
        const response = await fetch(`${window.PoliteCCAPI ? (window.location.hostname === 'polite-exam.vercel.app' ? '/api' : 'https://polite-exam.vercel.app/api') : '/api'}/auth/candidate/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Login successful
            const result = data.data;

            // Save session
            saveSession('candidate', result);

            // Clear form
            document.getElementById('signin-email').value = '';
            document.getElementById('signin-password').value = '';

            // Show dashboard
            showCandidateDashboard(result);
            window.PoliteCCAPI.showNotification('Welcome back!', 'success');

            // Check for any saved exam progress to resume
            checkAndResumeExam();
        } else if (data.requiresVerification) {
            // Account not verified - show verification pending screen
            document.getElementById('pending-verification-email').textContent = email;
            document.getElementById('candidate-signin-screen').classList.remove('active');
            document.getElementById('verification-pending-screen').classList.add('active');
            window.PoliteCCAPI.showNotification('Please verify your email first', 'info');
        } else {
            // Other error
            window.PoliteCCAPI.showNotification(data.error || 'Invalid email or password', 'error');
        }
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Password Reset
document.getElementById('reset-password-btn').addEventListener('click', async function() {
    try {
        const email = document.getElementById('forgot-email').value.trim();

        if (!email) {
            window.PoliteCCAPI.showNotification('Please enter your email address', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            window.PoliteCCAPI.showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Disable button while processing
        const btn = document.getElementById('reset-password-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        const result = await window.PoliteCCAPI.resetPassword(email);

        // Re-enable button
        btn.disabled = false;
        btn.textContent = 'Reset Password';

        if (result) {
            // Check if temp password is returned (dev mode only)
            if (result.tempPassword) {
                // Dev mode - show the temporary password
                document.getElementById('new-temp-password').textContent = result.tempPassword;
                document.getElementById('reset-result').style.display = 'block';
            } else {
                // Production mode - password sent via email
                document.getElementById('reset-result').innerHTML = `
                    <p style="font-weight: 600; color: #27ae60; margin-bottom: 10px;">✅ Password Reset Successful!</p>
                    <p style="color: #666; margin-bottom: 10px;">A new temporary password has been sent to:</p>
                    <div style="background: white; padding: 15px; border-radius: 8px; font-weight: 600; color: #2c3e50; text-align: center;">${email}</div>
                    <p style="color: #666; margin-top: 15px; font-size: 0.9rem;">
                        Please check your email and use the temporary password to sign in. We recommend changing it after logging in.
                    </p>
                    <button id="goto-signin-after-reset" style="margin-top: 15px; background: var(--success);">Go to Sign In</button>
                `;
                document.getElementById('reset-result').style.display = 'block';

                // Re-attach event handler for the new button
                document.getElementById('goto-signin-after-reset').addEventListener('click', function() {
                    document.getElementById('forgot-password-screen').classList.remove('active');
                    document.getElementById('candidate-signin-screen').classList.add('active');
                    // Reset the forgot password form
                    document.getElementById('forgot-email').value = '';
                    document.getElementById('forgot-email').style.display = 'block';
                    document.getElementById('reset-password-btn').style.display = 'block';
                    document.getElementById('reset-result').style.display = 'none';
                });
            }

            // Hide the form elements
            document.getElementById('forgot-email').style.display = 'none';
            btn.style.display = 'none';

            window.PoliteCCAPI.showNotification('✅ Password reset successful! Check your email.', 'success');
        }
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Store current user data globally for profile operations
let currentUserData = null;
let pendingProfileImage = null;

// Show Candidate Dashboard
async function showCandidateDashboard(userData) {
    document.getElementById('candidate-signin-screen').classList.remove('active');
    document.getElementById('hero-landing').classList.remove('active');
    document.getElementById('candidate-dashboard').classList.add('active');
    updateHeaderNav('candidate-dashboard');

    // Store user data
    currentUserData = userData;

    // Populate dashboard
    document.getElementById('dashboard-name').textContent = userData.name;
    document.getElementById('dashboard-email').textContent = userData.email;
    document.getElementById('dashboard-mobile').textContent = userData.mobile || 'Not set';
    document.getElementById('profile-name-display').textContent = userData.name;

    // Set profile initials
    const initials = userData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('profile-initials').textContent = initials;

    // Load profile image if exists
    if (userData.profileImage) {
        const imgContainer = document.getElementById('profile-image-display');
        imgContainer.innerHTML = `<img src="${userData.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    // Load exam history
    const examHistory = await window.PoliteCCAPI.getCandidateExamHistory(userData.email);

    if (examHistory && examHistory.examsGiven > 0) {
        // Update stats in the visible dashboard
        document.getElementById('dashboard-exams-taken').textContent = examHistory.examsGiven;

        // Calculate scores
        const scores = examHistory.examHistory.map(exam => exam.score || 0);
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / examHistory.examsGiven;
        const bestScore = Math.max(...scores);

        document.getElementById('dashboard-avg-score').textContent = avgScore.toFixed(1);
        document.getElementById('dashboard-best-score').textContent = bestScore.toFixed(1);

        // Show last exam date
        if (examHistory.examHistory.length > 0) {
            const lastExam = examHistory.examHistory[examHistory.examHistory.length - 1];
            document.getElementById('dashboard-last-exam').textContent = formatDateForDisplay(lastExam.timestamp || lastExam.date);
        }

        // Also update hidden elements for compatibility
        const totalExamsGiven = document.getElementById('total-exams-given');
        const averageScore = document.getElementById('average-score');
        if (totalExamsGiven) totalExamsGiven.textContent = examHistory.examsGiven;
        if (averageScore) averageScore.textContent = avgScore.toFixed(1);

        // Display recent results in the visible dashboard card
        const recentResultsContainer = document.getElementById('dashboard-recent-results');

        // Also update hidden container for compatibility
        const container = document.getElementById('exam-history-container');
        let historyHTML = '';

        examHistory.examHistory.forEach((exam, index) => {
            const date = formatDateForDisplay(exam.timestamp || exam.date);
            const scoreClass = (exam.score || 0) < 0 ? 'negative' : '';

            // Parse answers to build question details
            let questionDetailsHTML = '';
            try {
                const answers = typeof exam.answers === 'string' ? JSON.parse(exam.answers) : exam.answers || [];
                if (answers && answers.length > 0) {
                    // Check if it's detailed format (array of objects)
                    const isDetailedFormat = typeof answers[0] === 'object' && answers[0] !== null;

                    if (isDetailedFormat) {
                        answers.forEach((answer, qIndex) => {
                            const isMainPassage = answer.isMainPassage || (!answer.optionA && !answer.optionB);
                            const isSubQuestion = answer.isSubQuestion;
                            const isCorrect = answer.isCorrect;
                            const userAnswered = answer.userAnswer !== 'Not Answered' && answer.userAnswer !== 'N/A (Passage)';
                            const hierarchicalNum = answer.hierarchicalNumber || (qIndex + 1);

                            // Different styling for main passages vs regular questions
                            let statusClass, resultText, resultBadgeClass;
                            if (isMainPassage) {
                                statusClass = 'passage';
                                resultText = '📖 Reference Passage (No Marks)';
                                resultBadgeClass = 'passage';
                            } else {
                                statusClass = isCorrect ? 'correct' : (userAnswered ? 'incorrect' : 'unanswered');
                                resultText = isCorrect ? 'Correct (+1)' : (userAnswered ? 'Incorrect (-0.25)' : 'Not Answered (0)');
                                resultBadgeClass = isCorrect ? 'correct' : (userAnswered ? 'incorrect' : 'unanswered');
                            }
                            const userAnswerLetter = answer.userAnswer;
                            const correctAnswerLetter = answer.correctAnswer;

                            // Build question header with hierarchical number
                            const qLabel = isSubQuestion ? `Q.${hierarchicalNum}` : `Q${hierarchicalNum}`;
                            const typeIndicator = isMainPassage ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 8px;">Passage</span>' :
                                                 isSubQuestion ? '<span style="background: #9c27b0; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 8px;">Sub-Q</span>' : '';

                            questionDetailsHTML += `
                                <div class="question-detail-item ${statusClass}" style="${isMainPassage ? 'background: #fff3e0; border-left: 3px solid #ff9800;' : isSubQuestion ? 'background: #f3e5f5; border-left: 3px solid #9c27b0; margin-left: 20px;' : ''}">
                                    <div class="question-detail-header">${qLabel}. ${answer.questionId || ''} - ${answer.subject || ''}${typeIndicator}</div>
                                    <div class="question-detail-text" style="font-size: 1rem; line-height: 1.6; margin-bottom: 12px; color: #333;">${answer.question || ''}</div>`;

                            // Only show options for non-passage questions
                            if (!isMainPassage) {
                                questionDetailsHTML += `
                                    <div class="question-options" style="margin-bottom: 12px;">
                                        <div style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; background: ${userAnswerLetter === 'A' ? (isCorrect || correctAnswerLetter === 'A' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'A' ? '#c8e6c9' : '#f5f5f5')};">
                                            <strong>A:</strong> ${answer.optionA || ''} ${userAnswerLetter === 'A' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'A' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                                        </div>
                                        <div style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; background: ${userAnswerLetter === 'B' ? (isCorrect || correctAnswerLetter === 'B' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'B' ? '#c8e6c9' : '#f5f5f5')};">
                                            <strong>B:</strong> ${answer.optionB || ''} ${userAnswerLetter === 'B' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'B' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                                        </div>
                                        <div style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; background: ${userAnswerLetter === 'C' ? (isCorrect || correctAnswerLetter === 'C' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'C' ? '#c8e6c9' : '#f5f5f5')};">
                                            <strong>C:</strong> ${answer.optionC || ''} ${userAnswerLetter === 'C' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'C' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                                        </div>
                                        <div style="padding: 8px 12px; margin: 4px 0; border-radius: 6px; background: ${userAnswerLetter === 'D' ? (isCorrect || correctAnswerLetter === 'D' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'D' ? '#c8e6c9' : '#f5f5f5')};">
                                            <strong>D:</strong> ${answer.optionD || ''} ${userAnswerLetter === 'D' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'D' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                                        </div>
                                    </div>`;
                            }

                            questionDetailsHTML += `
                                    <div class="result-badge ${resultBadgeClass}" style="display: inline-block; ${isMainPassage ? 'background: #ff9800; color: white;' : ''}">${resultText}</div>
                                </div>
                            `;
                        });
                    } else {
                        questionDetailsHTML = '<p style="color: #666; text-align: center; padding: 20px;">Question details not available for this exam.</p>';
                    }
                } else {
                    questionDetailsHTML = '<p style="color: #666; text-align: center; padding: 20px;">No answer data available.</p>';
                }
            } catch (e) {
                console.error('Error parsing answers:', e);
                questionDetailsHTML = '<p style="color: #666; text-align: center; padding: 20px;">Unable to load question details.</p>';
            }

            historyHTML += `
                <div class="exam-history-card" data-exam-index="${index}">
                    <div class="exam-card-title">Exam: ${exam.examCode || 'N/A'}</div>
                    <div class="exam-card-details">
                        <div class="exam-card-score ${scoreClass}">Score: ${exam.score}</div>
                        <div class="exam-card-date">${date}</div>
                    </div>
                    <div class="exam-details-container">
                        <div style="font-weight: 600; color: var(--secondary); margin-bottom: 15px; font-size: 1rem;">📅 Exam Date: ${date}</div>
                        <div style="font-weight: 600; color: var(--primary); margin-bottom: 10px;">Question Details (Click anywhere on the card to collapse)</div>
                        ${questionDetailsHTML}
                    </div>
                </div>
            `;
        });

        if (container) {
            container.innerHTML = historyHTML;

            // Add click handlers for expanding/collapsing cards
            container.querySelectorAll('.exam-history-card').forEach(card => {
                card.addEventListener('click', function() {
                    this.classList.toggle('expanded');
                });
            });
        }

        // Also update the visible recent results card in dashboard
        if (recentResultsContainer) {
            // Sort exams by date descending (latest first)
            const sortedExams = [...examHistory.examHistory].sort((a, b) => {
                const dateA = new Date(a.timestamp || a.date || 0);
                const dateB = new Date(b.timestamp || b.date || 0);
                return dateB - dateA; // Descending order
            });

            let recentHTML = '';
            sortedExams.forEach((exam, index) => {
                const date = formatDateForDisplay(exam.timestamp || exam.date);
                const score = exam.score || 0;
                const scoreClass = score >= 0 ? 'text-success' : 'text-error';
                const scoreBg = score >= 0 ? 'bg-success/10' : 'bg-error/10';

                // Parse answers to build question details
                let questionDetailsHTML = '';
                let totalQuestions = 0;
                let correctCount = 0;
                let incorrectCount = 0;
                let unansweredCount = 0;

                try {
                    const answers = typeof exam.answers === 'string' ? JSON.parse(exam.answers) : exam.answers || [];
                    if (answers && answers.length > 0 && typeof answers[0] === 'object' && answers[0] !== null) {
                        answers.forEach((answer, qIndex) => {
                            const isMainPassage = answer.isMainPassage || (!answer.optionA && !answer.optionB);
                            if (isMainPassage) return; // Skip passages in count

                            totalQuestions++;
                            const isCorrect = answer.isCorrect;
                            const userAnswered = answer.userAnswer !== 'Not Answered' && answer.userAnswer !== 'N/A (Passage)';

                            if (isCorrect) correctCount++;
                            else if (userAnswered) incorrectCount++;
                            else unansweredCount++;

                            const userAnswerLetter = answer.userAnswer || 'Not Answered';
                            const correctAnswerLetter = answer.correctAnswer || '-';
                            const marks = isCorrect ? '+1' : (userAnswered ? '-0.25' : '0');
                            const marksClass = isCorrect ? 'text-success' : (userAnswered ? 'text-error' : 'text-base-content/50');
                            const rowBg = isCorrect ? 'bg-success/5' : (userAnswered ? 'bg-error/5' : 'bg-base-200');

                            // Helper function to get option background class
                            const getOptBg = (opt) => {
                                if (userAnswerLetter === opt && correctAnswerLetter === opt) return 'bg-success/20 border-l-4 border-success';
                                if (userAnswerLetter === opt && correctAnswerLetter !== opt) return 'bg-error/20 border-l-4 border-error';
                                if (correctAnswerLetter === opt) return 'bg-success/10 border-l-4 border-success';
                                return 'bg-base-200';
                            };

                            questionDetailsHTML += `
                                <div class="p-3 ${rowBg} rounded-lg mb-3 border border-base-300">
                                    <div class="flex justify-between items-start mb-2">
                                        <span class="font-semibold text-primary">Q${qIndex + 1}</span>
                                        <span class="badge ${isCorrect ? 'badge-success' : (userAnswered ? 'badge-error' : 'badge-ghost')}">${marks}</span>
                                    </div>
                                    <p class="text-sm mb-3 text-base-content/80 font-medium">${answer.question || 'Question text not available'}</p>

                                    <!-- All Options -->
                                    <div class="space-y-1 text-sm mb-2">
                                        <div class="p-2 rounded ${getOptBg('A')}">
                                            <span class="font-bold">A:</span> ${answer.optionA || 'N/A'}
                                            ${userAnswerLetter === 'A' ? '<span class="text-info font-semibold ml-2">(Your Answer)</span>' : ''}
                                            ${correctAnswerLetter === 'A' ? '<span class="text-success font-semibold ml-2">✓ Correct</span>' : ''}
                                        </div>
                                        <div class="p-2 rounded ${getOptBg('B')}">
                                            <span class="font-bold">B:</span> ${answer.optionB || 'N/A'}
                                            ${userAnswerLetter === 'B' ? '<span class="text-info font-semibold ml-2">(Your Answer)</span>' : ''}
                                            ${correctAnswerLetter === 'B' ? '<span class="text-success font-semibold ml-2">✓ Correct</span>' : ''}
                                        </div>
                                        <div class="p-2 rounded ${getOptBg('C')}">
                                            <span class="font-bold">C:</span> ${answer.optionC || 'N/A'}
                                            ${userAnswerLetter === 'C' ? '<span class="text-info font-semibold ml-2">(Your Answer)</span>' : ''}
                                            ${correctAnswerLetter === 'C' ? '<span class="text-success font-semibold ml-2">✓ Correct</span>' : ''}
                                        </div>
                                        <div class="p-2 rounded ${getOptBg('D')}">
                                            <span class="font-bold">D:</span> ${answer.optionD || 'N/A'}
                                            ${userAnswerLetter === 'D' ? '<span class="text-info font-semibold ml-2">(Your Answer)</span>' : ''}
                                            ${correctAnswerLetter === 'D' ? '<span class="text-success font-semibold ml-2">✓ Correct</span>' : ''}
                                        </div>
                                    </div>

                                    <div class="text-xs text-base-content/60 text-right">
                                        ${isCorrect ? '✅ Correct (+1)' : (userAnswered ? '❌ Wrong (-0.25)' : '⚪ Skipped (0)')}
                                    </div>
                                </div>
                            `;
                        });
                    } else {
                        questionDetailsHTML = '<p class="text-base-content/60 text-center py-4">Detailed question data not available for this exam.</p>';
                    }
                } catch (e) {
                    console.error('Error parsing exam answers:', e);
                    questionDetailsHTML = '<p class="text-base-content/60 text-center py-4">Unable to load question details.</p>';
                }

                recentHTML += `
                    <div class="exam-accordion-card border border-base-300 rounded-lg overflow-hidden mb-3" data-exam-index="${index}">
                        <div class="exam-accordion-header flex justify-between items-center p-4 cursor-pointer hover:bg-base-200 transition-all">
                            <div class="flex-1">
                                <div class="font-bold text-lg">${exam.examCode || 'Exam'}</div>
                                <div class="text-sm text-base-content/60">${date}</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="text-center ${scoreBg} px-4 py-2 rounded-lg">
                                    <div class="text-xl font-bold ${scoreClass}">${score}</div>
                                    <div class="text-xs text-base-content/60">Score</div>
                                </div>
                                <svg class="accordion-chevron h-5 w-5 text-base-content/40 transition-transform" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        <div class="exam-accordion-content hidden bg-base-100 border-t border-base-300">
                            <div class="p-4">
                                <!-- Summary Stats -->
                                <div class="grid grid-cols-3 gap-2 mb-4">
                                    <div class="text-center p-2 bg-success/10 rounded-lg">
                                        <div class="text-lg font-bold text-success">${correctCount}</div>
                                        <div class="text-xs text-base-content/60">Correct</div>
                                    </div>
                                    <div class="text-center p-2 bg-error/10 rounded-lg">
                                        <div class="text-lg font-bold text-error">${incorrectCount}</div>
                                        <div class="text-xs text-base-content/60">Wrong</div>
                                    </div>
                                    <div class="text-center p-2 bg-base-200 rounded-lg">
                                        <div class="text-lg font-bold text-base-content/60">${unansweredCount}</div>
                                        <div class="text-xs text-base-content/60">Skipped</div>
                                    </div>
                                </div>
                                <!-- Question Details -->
                                <h4 class="font-semibold mb-3 text-primary">Question-wise Details</h4>
                                <div class="max-h-96 overflow-y-auto">
                                    ${questionDetailsHTML}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            recentResultsContainer.innerHTML = recentHTML || '<p class="text-base-content/60">No exam results found.</p>';

            // Process LaTeX/math content in results
            processRichContentInContainer(recentResultsContainer);

            // Add click handlers for accordion
            recentResultsContainer.querySelectorAll('.exam-accordion-header').forEach(header => {
                header.addEventListener('click', function() {
                    const card = this.closest('.exam-accordion-card');
                    const content = card.querySelector('.exam-accordion-content');
                    const chevron = card.querySelector('.accordion-chevron');

                    // Toggle current card
                    content.classList.toggle('hidden');
                    chevron.classList.toggle('rotate-180');

                    // Optionally close other cards
                    recentResultsContainer.querySelectorAll('.exam-accordion-card').forEach(otherCard => {
                        if (otherCard !== card) {
                            otherCard.querySelector('.exam-accordion-content').classList.add('hidden');
                            otherCard.querySelector('.accordion-chevron').classList.remove('rotate-180');
                        }
                    });
                });
            });
        }
    } else {
        // No exam history
        document.getElementById('dashboard-exams-taken').textContent = '0';
        document.getElementById('dashboard-avg-score').textContent = '-';
        document.getElementById('dashboard-best-score').textContent = '-';
        document.getElementById('dashboard-last-exam').textContent = '-';

        const totalExamsGiven = document.getElementById('total-exams-given');
        const averageScore = document.getElementById('average-score');
        if (totalExamsGiven) totalExamsGiven.textContent = '0';
        if (averageScore) averageScore.textContent = '0';
    }
}

// Candidate Dashboard - Take Exam
document.getElementById('take-exam-dashboard-btn').addEventListener('click', async function() {
    const session = getSession();
    if (session && session.userType === 'candidate') {
        // Pre-fill candidate info
        document.getElementById('candidate-name').value = session.userData.name;
        document.getElementById('candidate-mobile').value = session.userData.mobile;
    }

    // Load active exams into dropdown
    const examSelect = document.getElementById('exam-code-input');
    examSelect.innerHTML = '<option value="">-- Loading Exams... --</option>';

    try {
        // Load exams and questions from API
        if (window.PoliteCCAPI && window.PoliteCCAPI.loadExams) {
            exams = await window.PoliteCCAPI.loadExams() || [];
            questions = await window.PoliteCCAPI.loadQuestions() || [];
        }

        // Filter only active exams (not expired)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeExams = exams.filter(exam => {
            if (!exam['Expiry (IST)']) return true; // No expiry means active
            const expiryDate = new Date(exam['Expiry (IST)']);
            expiryDate.setHours(0, 0, 0, 0);
            return expiryDate.getTime() >= today.getTime();
        });

        // Populate dropdown with active exams only
        examSelect.innerHTML = '<option value="">-- Select an Active Exam --</option>';
        activeExams.forEach(exam => {
            const option = document.createElement('option');
            option.value = exam['Exam Code'];
            option.textContent = `${exam['Exam Code']} - ${exam.Title || 'Untitled'}`;
            examSelect.appendChild(option);
        });

        if (activeExams.length === 0) {
            examSelect.innerHTML = '<option value="">-- No Active Exams Available --</option>';
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        examSelect.innerHTML = '<option value="">-- Error Loading Exams --</option>';
    }

    document.getElementById('candidate-dashboard').classList.remove('active');
    document.getElementById('candidate-login-screen').classList.add('active');
    updateHeaderNav('candidate-login-screen');
});

// Hero - Start Exam (for non-logged-in users)
document.getElementById('start-exam-hero-btn').addEventListener('click', function() {
    document.getElementById('hero-landing').classList.remove('active');
    document.getElementById('candidate-signin-screen').classList.add('active');
    updateHeaderNav('candidate-signin-screen');
});

// Dashboard - View Results
const dashboardViewResultsBtn = document.getElementById('dashboard-view-results-btn');
if (dashboardViewResultsBtn) {
    dashboardViewResultsBtn.addEventListener('click', async function() {
        const session = getSession();
        if (!session || session.userType !== 'candidate') {
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('Please sign in to view results', 'error');
            }
            return;
        }

        try {
            // Show loading notification
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('Loading your results...', 'info');
            }

            // Fetch results for this candidate
            if (window.PoliteCCAPI && window.PoliteCCAPI.getCandidateResults) {
                const results = await window.PoliteCCAPI.getCandidateResults(session.userData.email);

                // Display results in a modal or section
                const modal = document.getElementById('results-detail-modal');
                const content = document.getElementById('results-detail-content');

                if (modal && content) {
                    if (results && results.length > 0) {
                        let resultsHtml = '<h3 class="font-bold mb-4">Your Exam Results</h3><div class="space-y-3">';
                        results.forEach(result => {
                            resultsHtml += `
                                <div class="card bg-base-200 shadow-sm">
                                    <div class="card-body p-4">
                                        <div class="flex justify-between items-center">
                                            <div>
                                                <h4 class="font-bold">${result['Exam'] || result.examTitle || 'Unknown Exam'}</h4>
                                                <p class="text-sm text-base-content/60">${result.Date || new Date(result.createdAt).toLocaleDateString() || ''}</p>
                                            </div>
                                            <div class="text-2xl font-bold text-primary">${result.Score || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        resultsHtml += '</div>';
                        content.innerHTML = resultsHtml;
                    } else {
                        content.innerHTML = '<p class="text-center text-base-content/60 py-8">No exam results found. Take an exam to see your results here.</p>';
                    }
                    content.classList.remove('hidden');
                    modal.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Error loading results:', error);
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('Failed to load results: ' + error.message, 'error');
            }
        }
    });
}

// Candidate Logout
document.getElementById('candidate-logout-link').addEventListener('click', function(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        // Clear any running exam timer
        if (typeof examTimer !== 'undefined' && examTimer) {
            clearInterval(examTimer);
            examTimer = null;
        }
        clearSession();
        currentUserData = null;
        document.getElementById('candidate-dashboard').classList.remove('active');
        document.getElementById('hero-landing').classList.add('active');
        updateHeaderNav('hero-landing');
        window.PoliteCCAPI.showNotification('Logged out successfully', 'success');
    }
});

// =====================================================
// PROFILE EDITING HANDLERS
// =====================================================

// Open edit profile modal
document.getElementById('edit-profile-btn').addEventListener('click', function() {
    if (!currentUserData) return;

    // Populate form with current data
    document.getElementById('edit-profile-name').value = currentUserData.name || '';
    document.getElementById('edit-profile-mobile').value = currentUserData.mobile || '';

    // Show current profile image or initials
    const preview = document.getElementById('modal-profile-preview');
    if (currentUserData.profileImage) {
        preview.innerHTML = `<img src="${currentUserData.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        const initials = currentUserData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        preview.innerHTML = initials;
    }

    pendingProfileImage = null;
    document.getElementById('edit-profile-modal').style.display = 'flex';
});

// Edit mobile link
document.getElementById('edit-mobile-link').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('edit-profile-btn').click();
});

// Close profile modal
document.getElementById('close-profile-modal').addEventListener('click', function() {
    document.getElementById('edit-profile-modal').style.display = 'none';
    pendingProfileImage = null;
});

// Handle profile image selection in modal
document.getElementById('modal-profile-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 500KB)
    if (file.size > 500 * 1024) {
        window.PoliteCCAPI.showNotification('Image too large. Maximum size is 500KB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        pendingProfileImage = event.target.result;
        document.getElementById('modal-profile-preview').innerHTML =
            `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
    };
    reader.readAsDataURL(file);
});

// Quick profile image upload from dashboard
document.getElementById('profile-image-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || !currentUserData) return;

    if (file.size > 500 * 1024) {
        window.PoliteCCAPI.showNotification('Image too large. Maximum size is 500KB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
        const result = await window.PoliteCCAPI.updateCandidateProfile({
            email: currentUserData.email,
            profileImage: event.target.result
        });

        if (result) {
            currentUserData.profileImage = event.target.result;
            document.getElementById('profile-image-display').innerHTML =
                `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }
    };
    reader.readAsDataURL(file);
});

// Save profile changes
document.getElementById('save-profile-btn').addEventListener('click', async function() {
    if (!currentUserData) return;

    const name = document.getElementById('edit-profile-name').value.trim();
    const mobile = document.getElementById('edit-profile-mobile').value.trim();

    // Validation
    if (name && (name.length < 2 || name.length > 100)) {
        window.PoliteCCAPI.showNotification('Name must be between 2 and 100 characters', 'error');
        return;
    }

    if (mobile && (mobile.length !== 10 || isNaN(mobile))) {
        window.PoliteCCAPI.showNotification('Please enter a valid 10-digit mobile number', 'error');
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const updateData = {
        email: currentUserData.email
    };
    if (name) updateData.name = name;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (pendingProfileImage) updateData.profileImage = pendingProfileImage;

    const result = await window.PoliteCCAPI.updateCandidateProfile(updateData);

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (result) {
        // Update local data
        if (name) {
            currentUserData.name = name;
            document.getElementById('dashboard-name').textContent = name;
            document.getElementById('profile-name-display').textContent = name;
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            if (!currentUserData.profileImage && !pendingProfileImage) {
                document.getElementById('profile-initials').textContent = initials;
            }
        }
        if (mobile !== undefined) {
            currentUserData.mobile = mobile;
            document.getElementById('dashboard-mobile').textContent = mobile || 'Not set';
        }
        if (pendingProfileImage) {
            currentUserData.profileImage = pendingProfileImage;
            document.getElementById('profile-image-display').innerHTML =
                `<img src="${pendingProfileImage}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        // Update session
        saveSession('candidate', currentUserData);

        // Close modal
        document.getElementById('edit-profile-modal').style.display = 'none';
        pendingProfileImage = null;
    }
});

// =====================================================
// CHANGE PASSWORD HANDLERS
// =====================================================

// Toggle password form inside profile modal
document.getElementById('change-password-btn').addEventListener('click', function() {
    const passwordForm = document.getElementById('password-change-form');
    const changePasswordSection = document.getElementById('change-password-section');

    if (passwordForm) {
        // Toggle the form visibility
        if (passwordForm.classList.contains('hidden')) {
            passwordForm.classList.remove('hidden');
            if (changePasswordSection) changePasswordSection.classList.add('hidden');
            // Clear form fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';
        } else {
            passwordForm.classList.add('hidden');
            if (changePasswordSection) changePasswordSection.classList.remove('hidden');
        }
    }
});

// Close password modal (for the old separate modal - keep for compatibility)
const closePasswordModal = document.getElementById('close-password-modal');
if (closePasswordModal) {
    closePasswordModal.addEventListener('click', function() {
        document.getElementById('change-password-modal').style.display = 'none';
    });
}

// Save new password
document.getElementById('save-password-btn').addEventListener('click', async function() {
    if (!currentUserData) return;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        window.PoliteCCAPI.showNotification('Please fill all fields', 'error');
        return;
    }

    if (newPassword.length < 6) {
        window.PoliteCCAPI.showNotification('New password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        window.PoliteCCAPI.showNotification('New passwords do not match', 'error');
        return;
    }

    if (currentPassword === newPassword) {
        window.PoliteCCAPI.showNotification('New password must be different from current password', 'error');
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Changing...';

    const result = await window.PoliteCCAPI.changePassword(
        currentUserData.email,
        currentPassword,
        newPassword
    );

    btn.disabled = false;
    btn.textContent = 'Update Password';

    if (result) {
        // Clear form and hide password section
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';

        // Hide password form, show change password button
        const passwordForm = document.getElementById('password-change-form');
        const changePasswordSection = document.getElementById('change-password-section');
        if (passwordForm) passwordForm.classList.add('hidden');
        if (changePasswordSection) changePasswordSection.classList.remove('hidden');

        window.PoliteCCAPI.showNotification('Password changed successfully!', 'success');
    }
});

// Close modals on overlay click
document.getElementById('edit-profile-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
        pendingProfileImage = null;
    }
});

document.getElementById('change-password-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

// Admin Login
document.getElementById('admin-login-btn').addEventListener('click', async function() {
    try {
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;
        const errorElement = document.getElementById('admin-login-error');

        if (!username || !password) {
            errorElement.textContent = 'Please fill all fields';
            return;
        }

        const result = await window.PoliteCCAPI.adminLogin(username, password);

        if (result) {
            saveSession('admin', result);

            document.getElementById('admin-login-screen').classList.remove('active');
            document.getElementById('admin-panel').classList.add('active');
            document.getElementById('question-bank-section').classList.remove('hidden');
            updateHeaderNav('admin-panel');

            // Check system status when admin logs in
            if (window.PoliteCCAPI && window.PoliteCCAPI.checkSystemStatus) {
                await window.PoliteCCAPI.checkSystemStatus();
            }

            // Auto-load questions when admin panel opens
            document.getElementById('question-bank-btn').click();

            // Clear form
            document.getElementById('admin-username').value = '';
            document.getElementById('admin-password').value = '';
            errorElement.textContent = '';
        } else {
            errorElement.textContent = '❌ Invalid credentials';
        }
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Admin logout function
document.getElementById('logout-btn').addEventListener('click', function() {
    // Clear any running timers
    if (typeof examTimer !== 'undefined' && examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
    clearSession();
    document.getElementById('admin-panel').classList.remove('active');
    document.getElementById('hero-landing').classList.add('active');
    updateHeaderNav('hero-landing');
    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification('Logged out successfully', 'success');
    }
});

// Exam screen logout function (for candidates taking exams)
const candidateLogoutBtn = document.getElementById('candidate-logout-btn');
if (candidateLogoutBtn) {
    candidateLogoutBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to logout? Your current progress will be lost.')) {
            // Stop exam timer - check both variable names for compatibility
            if (typeof examTimer !== 'undefined' && examTimer) {
                clearInterval(examTimer);
                examTimer = null;
            }
            if (typeof timerInterval !== 'undefined' && timerInterval) {
                clearInterval(timerInterval);
            }
            // Reset to dashboard or landing
            const session = getSession();
            document.getElementById('exam-screen').classList.remove('active');
            if (session && session.userType === 'candidate') {
                showCandidateDashboard(session.userData);
            } else {
                document.getElementById('hero-landing').classList.add('active');
            }
            // Clear form fields
            const examCodeInput = document.getElementById('exam-code-input');
            const candidateNameInput = document.getElementById('candidate-name');
            const candidateMobileInput = document.getElementById('candidate-mobile');
            if (examCodeInput) examCodeInput.value = '';
            if (candidateNameInput) candidateNameInput.value = '';
            if (candidateMobileInput) candidateMobileInput.value = '';
        }
    });
}

// Show question bank
// Question Bank State Management
let allQuestions = []; // Full question bank from database
let filteredQuestions = []; // Questions after search/filter
let displayedQuestionsCount = 0; // How many are currently displayed
let selectedQuestionIds = new Set(); // Track selected questions by their database ID
const QUESTIONS_PER_PAGE = 100;
let isLoadingMoreQuestions = false;

// Function to group questions hierarchically (attach sub-questions to their parent)
function groupQuestionsHierarchically(questions) {
    const parentQuestions = [];
    const childQuestions = [];
    const subQuestionsMap = {};

    // First pass: separate parent questions and child questions
    questions.forEach(q => {
        const questionType = q['Question Type'];
        const parentQuestionLinks = q['Parent Question']; // Array of record IDs (linked record field)

        // Child question: has 'Parent-child' type AND has Parent Question link
        const isChild = questionType === 'Parent-child' &&
                       parentQuestionLinks &&
                       parentQuestionLinks.length > 0;

        // Parent question: has 'Parent-child' type AND no Parent Question link
        // OR has 'Main Question Text' field (passage)
        const isParent = (questionType === 'Parent-child' &&
                         (!parentQuestionLinks || parentQuestionLinks.length === 0)) ||
                        q['Main Question Text'];

        if (isChild) {
            // This is a child question - group by parent's record ID
            const parentRecordId = parentQuestionLinks[0];
            if (!subQuestionsMap[parentRecordId]) {
                subQuestionsMap[parentRecordId] = [];
            }
            subQuestionsMap[parentRecordId].push(q);
            childQuestions.push(q);
        } else if (isParent) {
            // This is a parent/passage question
            parentQuestions.push(q);
        } else {
            // Standalone question
            parentQuestions.push(q);
        }
    });

    // Sort sub-questions by Sub Question Number
    Object.keys(subQuestionsMap).forEach(parentRecordId => {
        subQuestionsMap[parentRecordId].sort((a, b) => {
            const orderA = parseInt(a['Sub Question Number']) || 0;
            const orderB = parseInt(b['Sub Question Number']) || 0;
            return orderA - orderB;
        });
    });

    // Attach sub-questions to their parent using parent's record ID (not display ID)
    const groupedQuestions = parentQuestions.map(q => {
        const children = subQuestionsMap[q.id] || [];
        return {
            ...q,
            subQuestions: children,
            hasSubQuestions: children.length > 0,
            totalQuestions: 1 + children.length
        };
    });

    // Log for debugging
    console.log('Grouped questions:', {
        total: questions.length,
        parents: parentQuestions.length,
        children: childQuestions.length,
        grouped: groupedQuestions.length
    });

    return groupedQuestions;
}

// Question Cart - stores full question objects for exam creation
let questionCart = new Map(); // Map of question id/displayId -> question object

// Function to update question bank stats
function updateQuestionBankStats() {
    // Calculate total questions including sub-questions
    let totalIncludingChildren = 0;
    allQuestions.forEach(q => {
        if (q.hasSubQuestions && q.subQuestions) {
            totalIncludingChildren += q.subQuestions.length; // Count children only (parent is just a passage)
        } else if (q['Question Type'] !== 'Parent-child' || q['Option A']) {
            totalIncludingChildren += 1; // Count standalone questions
        }
    });

    // Calculate selected questions count (including children when parent is selected)
    let selectedCount = 0;
    selectedQuestionIds.forEach(id => {
        const question = allQuestions.find(q => (q.id === id || q.ID === id));
        if (question) {
            if (question.hasSubQuestions && question.subQuestions) {
                selectedCount += question.subQuestions.length; // Count children when parent selected
            } else {
                selectedCount += 1;
            }
        } else {
            selectedCount += 1;
        }
    });

    // Calculate cart count (including children)
    let cartCount = 0;
    questionCart.forEach((question) => {
        if (question.hasSubQuestions && question.subQuestions) {
            cartCount += question.subQuestions.length;
        } else {
            cartCount += 1;
        }
    });

    document.getElementById('total-questions-count').textContent = totalIncludingChildren;
    document.getElementById('selected-questions-count').textContent = selectedCount;
    document.getElementById('showing-questions-count').textContent = Math.min(displayedQuestionsCount, filteredQuestions.length);
    document.getElementById('cart-questions-count').textContent = cartCount;
    // Also update exam cart count if it exists
    const examCartCount = document.getElementById('exam-cart-count');
    if (examCartCount) {
        examCartCount.textContent = cartCount;
    }
}

// Function to add question to cart
function addToCart(question) {
    const key = question.id || question.ID;
    if (!questionCart.has(key)) {
        questionCart.set(key, question);
        updateQuestionBankStats();
        return true;
    }
    return false;
}

// Function to remove question from cart
function removeFromCart(questionId) {
    if (questionCart.has(questionId)) {
        questionCart.delete(questionId);
        updateQuestionBankStats();
        return true;
    }
    return false;
}

// Function to toggle cart item
function toggleCartItem(question) {
    const key = question.id || question.ID;
    if (questionCart.has(key)) {
        questionCart.delete(key);
        updateQuestionBankStats();
        return false; // removed
    } else {
        questionCart.set(key, question);
        updateQuestionBankStats();
        return true; // added
    }
}

// Function to clear cart
function clearCart() {
    questionCart.clear();
    updateQuestionBankStats();
}

// Function to get cart statistics
function getCartStats() {
    const stats = {
        total: questionCart.size,
        subjects: {},
        difficulties: { Easy: 0, Medium: 0, Hard: 0 }
    };

    questionCart.forEach((q) => {
        // Count by subject
        const subject = q.Subject || 'Unknown';
        if (!stats.subjects[subject]) {
            stats.subjects[subject] = { total: 0, Easy: 0, Medium: 0, Hard: 0 };
        }
        stats.subjects[subject].total++;

        // Count by difficulty
        const difficulty = q.Difficulty || 'Unknown';
        if (stats.difficulties[difficulty] !== undefined) {
            stats.difficulties[difficulty]++;
            stats.subjects[subject][difficulty]++;
        }
    });

    return stats;
}

// Function to render a single question item (supports grouped questions with sub-questions)
function renderQuestionItem(q, index) {
    const isSelected = selectedQuestionIds.has(q.id || q.ID);
    const questionType = q['Question Type'];
    const parentQuestionLinks = q['Parent Question'];
    const hasSubQuestions = q.subQuestions && q.subQuestions.length > 0;
    const subQuestionCount = q.subQuestions ? q.subQuestions.length : 0;

    // Check if this is a child question (has Parent-child type AND has Parent Question link)
    const isChildQuestion = questionType === 'Parent-child' &&
                           parentQuestionLinks &&
                           parentQuestionLinks.length > 0;

    // Check if this is a main/passage question (parent with sub-questions but no options)
    const isMainPassage = (hasSubQuestions || q['Main Question Text']) &&
                         (!q['Option A'] || !q['Option B']);

    // Skip rendering child questions individually (they will be rendered with their parent)
    if (isChildQuestion) {
        return ''; // Child questions are rendered as part of parent
    }

    // Extract question number from ID (e.g., Q0012 -> 12)
    const qNumMatch = (q.ID || '').match(/^[qQ](\d+)$/);
    const qNum = qNumMatch ? parseInt(qNumMatch[1]) : index + 1;

    // Render main question with optional sub-questions
    let html = `
    <div class="question-item ${hasSubQuestions ? 'has-sub-questions' : ''}" data-question-id="${q.id || ''}" data-question-display-id="${q.ID}" data-index="${index}" style="background: ${isSelected ? '#e3f2fd' : hasSubQuestions ? '#faf5ff' : '#f8f9fa'}; border-radius: 10px; padding: 15px; margin-bottom: 12px; border-left: 4px solid ${isSelected ? '#2196f3' : hasSubQuestions ? '#9c27b0' : 'var(--secondary)'}; position: relative; padding-right: 60px; padding-left: 15px; transition: all 0.2s;">
        <!-- Checkbox for selection -->
        <div style="position: absolute; top: 15px; right: 60px;">
            <input type="checkbox" class="question-select-checkbox" data-question-id="${q.id || ''}" data-question-display-id="${q.ID}" data-index="${index}" data-has-sub-questions="${hasSubQuestions}" data-sub-question-count="${subQuestionCount}" style="width: 18px; height: 18px; cursor: pointer;" ${isSelected ? 'checked' : ''}>
        </div>

        <!-- Action buttons in top right -->
        <div style="position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px;">
            <button class="delete-question-btn" data-question-id="${q.id || ''}" data-index="${index}" title="Delete Question" style="background: var(--danger); color: white; border: none; width: 35px; height: 35px; border-radius: 6px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                🗑️
            </button>
            <button class="edit-question-btn" data-question-id="${q.id || ''}" data-index="${index}" title="Edit Question" style="background: var(--primary); color: white; border: none; width: 35px; height: 35px; border-radius: 6px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                ✏️
            </button>
            <button class="add-to-cart-btn" data-question-id="${q.id || ''}" data-question-display-id="${q.ID}" data-index="${index}" title="${hasSubQuestions ? 'Add Group to Cart' : 'Add to Cart'}" style="background: ${questionCart.has(q.id || q.ID) ? '#27ae60' : '#f39c12'}; color: white; border: none; width: 35px; height: 35px; border-radius: 6px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                ${questionCart.has(q.id || q.ID) ? '✓' : '🛒'}
            </button>
        </div>

        <div style="margin-bottom: 8px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
            <strong style="font-size: 1.1rem; color: ${hasSubQuestions ? '#9c27b0' : 'var(--secondary)'};">${q.ID}</strong>
            <span class="question-tag" style="background: var(--secondary); color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">${q.Subject || 'Unknown'}</span>
            <span class="difficulty-tag" style="background: ${q.Difficulty === 'Easy' ? '#27ae60' : q.Difficulty === 'Medium' ? '#f39c12' : q.Difficulty === 'Hard' ? '#e74c3c' : '#95a5a6'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">${q.Difficulty || 'Unknown'}</span>
            ${hasSubQuestions ? `
                <span style="background: #9c27b0; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">📋 ${subQuestionCount} Sub-Questions</span>
                <span style="background: #4caf50; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: bold;">⚖️ Weightage: ${subQuestionCount} marks</span>
            ` : ''}
            ${isMainPassage && !hasSubQuestions ? `<span style="background: #ff9800; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">📖 Passage</span>` : ''}
            ${!hasSubQuestions && !isMainPassage ? `<span style="background: #4caf50; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem;">⚖️ 1 mark</span>` : ''}
        </div>
        <p class="rich-content" style="margin-bottom: 10px; font-weight: 500; font-size: 1.1rem;">${escapeHtmlForRichContent(q.Question || '')}</p>`;

    // Only show options and correct answer for non-passage questions
    if (!isMainPassage) {
        html += `
        <div style="margin-left: 25px; margin-bottom: 8px;">
            <div class="rich-content" style="margin: 5px 0;">A) ${escapeHtmlForRichContent(q['Option A'] || '')}</div>
            <div class="rich-content" style="margin: 5px 0;">B) ${escapeHtmlForRichContent(q['Option B'] || '')}</div>
            <div class="rich-content" style="margin: 5px 0;">C) ${escapeHtmlForRichContent(q['Option C'] || '')}</div>
            <div class="rich-content" style="margin: 5px 0;">D) ${escapeHtmlForRichContent(q['Option D'] || '')}</div>
        </div>
        <div style="color: var(--success); font-weight: 600; background: #e8f5e9; padding: 8px; border-radius: 6px; display: inline-block;">
            ✅ Correct Answer: ${(q.Correct || q['Correct Answer'] || '').toString().toUpperCase()}
        </div>`;
    } else {
        html += `
        <div style="color: #ff9800; font-weight: 600; background: #fff3e0; padding: 8px; border-radius: 6px; display: inline-block; margin-top: 10px;">
            📖 Reference passage - Marks are in sub-questions below
        </div>`;
    }

    // Render sub-questions if any (grouped under parent)
    if (hasSubQuestions) {
        html += `
        <div class="sub-questions-container" style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #9c27b0;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; background: #f3e5f5; padding: 10px; border-radius: 8px;">
                <div style="color: #9c27b0; font-weight: 600; font-size: 0.95rem;">
                    📋 Sub-Questions (${subQuestionCount})
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <span style="background: #4caf50; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">Max: ${subQuestionCount} marks</span>
                    <span style="background: #2196f3; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">+1 correct</span>
                    <span style="background: #f44336; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">-0.25 wrong</span>
                    <span style="background: #9e9e9e; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">0 unanswered</span>
                </div>
            </div>`;

        q.subQuestions.forEach((sq, sqIndex) => {
            const subOrder = sq['Sub Question Number'] || sqIndex + 1;
            // Use stored ID if it's hierarchical (Q0508.1), otherwise calculate from parent
            const storedId = sq.ID || '';
            const isHierarchicalId = storedId.includes('.');
            const displayId = isHierarchicalId ? storedId : `${q.ID}.${subOrder}`;
            html += `
            <div class="sub-question-item" style="background: #f3e5f5; border-radius: 8px; padding: 12px; margin-bottom: 10px; margin-left: 20px; border-left: 3px solid #9c27b0; position: relative; padding-left: 75px;">
                <!-- Sub-question number badge - shows hierarchical ID (Q0508.1) -->
                <div style="position: absolute; top: 12px; left: 12px; background: #9c27b0; color: white; padding: 4px 12px; border-radius: 15px; font-weight: bold; font-size: 0.85rem;">
                    ${displayId}
                </div>
                <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="background: #ce93d8; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${sq.Subject || q.Subject || 'Unknown'}</span>
                    <span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">+1 / -0.25</span>
                </div>
                <p class="rich-content" style="margin-bottom: 8px; font-weight: 500; font-size: 1rem;">${escapeHtmlForRichContent(sq.Question || '')}</p>
                <div style="margin-left: 10px; font-size: 0.95rem; background: white; padding: 10px; border-radius: 6px;">
                    <div class="rich-content" style="margin: 4px 0;">A) ${escapeHtmlForRichContent(sq['Option A'] || '')}</div>
                    <div class="rich-content" style="margin: 4px 0;">B) ${escapeHtmlForRichContent(sq['Option B'] || '')}</div>
                    <div class="rich-content" style="margin: 4px 0;">C) ${escapeHtmlForRichContent(sq['Option C'] || '')}</div>
                    <div class="rich-content" style="margin: 4px 0;">D) ${escapeHtmlForRichContent(sq['Option D'] || '')}</div>
                </div>
                <div style="color: var(--success); font-weight: 600; background: #e8f5e9; padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 0.9rem; margin-top: 8px;">
                    ✅ Correct: ${(sq.Correct || sq['Correct Answer'] || '').toString().toUpperCase()}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    html += `</div>`;
    return html;
}

// Function to apply search and filter
function applySearchAndFilter() {
    const searchTerm = document.getElementById('question-search-input').value.toLowerCase().trim();
    const subjectFilter = document.getElementById('question-filter-subject').value;
    const difficultyFilter = document.getElementById('question-filter-difficulty').value;

    filteredQuestions = allQuestions.filter(q => {
        const matchesSearch = !searchTerm ||
            (q.Question && q.Question.toLowerCase().includes(searchTerm)) ||
            (q.ID && q.ID.toLowerCase().includes(searchTerm)) ||
            (q['Option A'] && q['Option A'].toLowerCase().includes(searchTerm)) ||
            (q['Option B'] && q['Option B'].toLowerCase().includes(searchTerm)) ||
            (q['Option C'] && q['Option C'].toLowerCase().includes(searchTerm)) ||
            (q['Option D'] && q['Option D'].toLowerCase().includes(searchTerm));

        const matchesSubject = !subjectFilter || q.Subject === subjectFilter;
        const matchesDifficulty = !difficultyFilter || q.Difficulty === difficultyFilter;

        return matchesSearch && matchesSubject && matchesDifficulty;
    });

    displayedQuestionsCount = 0;
    document.getElementById('questions-list').innerHTML = '';
    loadMoreQuestions();
}

// Function to load more questions (pagination)
function loadMoreQuestions() {
    if (isLoadingMoreQuestions) return;
    if (displayedQuestionsCount >= filteredQuestions.length) return;

    isLoadingMoreQuestions = true;
    document.getElementById('questions-loading-more').style.display = 'block';

    // Simulate small delay for UX (can be removed for instant loading)
    setTimeout(() => {
        const questionsList = document.getElementById('questions-list');
        const startIndex = displayedQuestionsCount;
        const endIndex = Math.min(startIndex + QUESTIONS_PER_PAGE, filteredQuestions.length);

        let html = '';
        for (let i = startIndex; i < endIndex; i++) {
            html += renderQuestionItem(filteredQuestions[i], i);
        }

        questionsList.insertAdjacentHTML('beforeend', html);
        displayedQuestionsCount = endIndex;

        // Process rich content (render math expressions) in newly added questions
        processRichContentInContainer(questionsList);

        // Attach event listeners to new elements
        attachQuestionEventListeners(startIndex, endIndex);

        document.getElementById('questions-loading-more').style.display = 'none';
        isLoadingMoreQuestions = false;
        updateQuestionBankStats();
    }, 100);
}

// Function to attach event listeners to question items
function attachQuestionEventListeners(startIndex, endIndex) {
    // Checkbox change listeners
    document.querySelectorAll('.question-select-checkbox').forEach(cb => {
        if (!cb.hasAttribute('data-listener-attached')) {
            cb.setAttribute('data-listener-attached', 'true');
            cb.addEventListener('change', function() {
                const questionId = this.getAttribute('data-question-id') || this.getAttribute('data-question-display-id');
                const questionItem = this.closest('.question-item');

                if (this.checked) {
                    selectedQuestionIds.add(questionId);
                    if (questionItem) {
                        questionItem.style.background = '#e3f2fd';
                        questionItem.style.borderLeftColor = '#2196f3';
                    }
                } else {
                    selectedQuestionIds.delete(questionId);
                    if (questionItem) {
                        questionItem.style.background = '#f8f9fa';
                        questionItem.style.borderLeftColor = 'var(--secondary)';
                    }
                }
                updateQuestionBankStats();
            });
        }
    });

    // Delete button listeners
    document.querySelectorAll('.delete-question-btn').forEach(btn => {
        if (!btn.hasAttribute('data-listener-attached')) {
            btn.setAttribute('data-listener-attached', 'true');
            btn.addEventListener('click', async function(e) {
                try {
                    e.stopPropagation();
                    const questionId = this.getAttribute('data-question-id');
                    const index = parseInt(this.getAttribute('data-index'));

                    if (confirm('Are you sure you want to delete this question?')) {
                        if (questionId && window.PoliteCCAPI && window.PoliteCCAPI.deleteQuestionFromDatabase) {
                            const success = await window.PoliteCCAPI.deleteQuestionFromDatabase(questionId);
                            if (success) {
                                // Remove from arrays
                                const q = filteredQuestions[index];
                                allQuestions = allQuestions.filter(aq => aq.id !== questionId);
                                selectedQuestionIds.delete(questionId);
                                // Refresh display
                                applySearchAndFilter();
                            }
                        } else {
                            // Remove from local array only
                            allQuestions.splice(index, 1);
                            applySearchAndFilter();
                        }
                    }
                } catch (error) {
                    console.error('❌ Delete error:', error);
                    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                        window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
                    }
                }
            });
        }
    });

    // Edit button listeners
    document.querySelectorAll('.edit-question-btn').forEach(btn => {
        if (!btn.hasAttribute('data-listener-attached')) {
            btn.setAttribute('data-listener-attached', 'true');
            btn.addEventListener('click', function(e) {
                try {
                    e.stopPropagation();
                    const index = parseInt(this.getAttribute('data-index'));
                    const question = filteredQuestions[index];

                    document.getElementById('add-question-form').classList.remove('hidden');
                    document.getElementById('question-subject').value = question.Subject || 'Others';
                    document.getElementById('question-difficulty').value = question.Difficulty || 'Medium';
                    document.getElementById('question-text').value = question.Question || '';
                    document.getElementById('option-a').value = question['Option A'] || '';
                    document.getElementById('option-b').value = question['Option B'] || '';
                    document.getElementById('option-c').value = question['Option C'] || '';
                    document.getElementById('option-d').value = question['Option D'] || '';

                    const correctValue = question.Correct || question['Correct Answer'] || 'A';
                    const correctLetter = String(correctValue).toUpperCase().trim();
                    const correctIndex = correctLetter.charCodeAt(0) - 65;
                    document.getElementById('correct-answer').value = (correctIndex >= 0 && correctIndex <= 3) ? correctIndex : 0;

                    const addBtn = document.getElementById('add-question-btn');
                    addBtn.textContent = 'Update Question';
                    addBtn.setAttribute('data-edit-index', index);
                    addBtn.setAttribute('data-edit-id', question.id || '');
                    addBtn.setAttribute('data-edit-mode', 'true');

                    document.getElementById('add-question-form').scrollIntoView({ behavior: 'smooth' });
                } catch (error) {
                    console.error('❌ Edit error:', error);
                    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                        window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
                    }
                }
            });
        }
    });

    // Cart button listeners
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        if (!btn.hasAttribute('data-listener-attached')) {
            btn.setAttribute('data-listener-attached', 'true');
            btn.addEventListener('click', function(e) {
                try {
                    e.stopPropagation();
                    const index = parseInt(this.getAttribute('data-index'));
                    const question = filteredQuestions[index];
                    const key = question.id || question.ID;

                    const added = toggleCartItem(question);

                    // Update button appearance
                    if (added) {
                        this.style.background = '#27ae60';
                        this.innerHTML = '✓';
                        this.title = 'Remove from Cart';
                        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                            window.PoliteCCAPI.showNotification(`Added ${question.ID} to cart`, 'success');
                        }
                    } else {
                        this.style.background = '#f39c12';
                        this.innerHTML = '🛒';
                        this.title = 'Add to Cart';
                        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                            window.PoliteCCAPI.showNotification(`Removed ${question.ID} from cart`, 'info');
                        }
                    }
                } catch (error) {
                    console.error('❌ Cart error:', error);
                    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                        window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
                    }
                }
            });
        }
    });
}

// Main question bank button click handler
document.getElementById('question-bank-btn').addEventListener('click', async function() {
    try {
        document.getElementById('question-bank-section').classList.remove('hidden');
        document.getElementById('create-exam-section').classList.add('hidden');
        document.getElementById('view-results-section').classList.add('hidden');
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('ai-generator-section').classList.add('hidden');

        const questionsList = document.getElementById('questions-list');
        questionsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Loading questions from database...</p>';

        // Load questions via API
        if (window.PoliteCCAPI && window.PoliteCCAPI.loadQuestions) {
            allQuestions = await window.PoliteCCAPI.loadQuestions() || [];
        }

        // Sort by ID descending (newest/highest ID first) - keep original IDs
        allQuestions.sort((a, b) => {
            const matchA = (a.ID || '').match(/^[qQ](\d+)$/);
            const matchB = (b.ID || '').match(/^[qQ](\d+)$/);
            const numA = matchA ? parseInt(matchA[1]) : 0;
            const numB = matchB ? parseInt(matchB[1]) : 0;
            return numB - numA;
        });

        // Store original flat list for exam creation
        questions = [...allQuestions];

        // Group questions hierarchically for display
        // This attaches sub-questions to their parent questions
        allQuestions = groupQuestionsHierarchically(allQuestions);
        console.log(`📋 Grouped ${questions.length} questions into ${allQuestions.length} display items`);

        // Reset search and filter
        document.getElementById('question-search-input').value = '';
        document.getElementById('question-filter-subject').value = '';

        // Apply filter and load first batch
        applySearchAndFilter();

        if (allQuestions.length === 0) {
            questionsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No questions found. Click "Add New Question" button above to add your first question!</p>';
        }
    } catch (error) {
        console.error('❌ Question bank error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Infinite scroll for questions list
document.getElementById('questions-list').addEventListener('scroll', function() {
    const { scrollTop, scrollHeight, clientHeight } = this;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadMoreQuestions();
    }
});

// Search input handler with debounce
let searchDebounceTimer;
document.getElementById('question-search-input').addEventListener('input', function() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applySearchAndFilter();
    }, 300);
});

// Subject filter handler
document.getElementById('question-filter-subject').addEventListener('change', function() {
    applySearchAndFilter();
});

// Difficulty filter handler
document.getElementById('question-filter-difficulty').addEventListener('change', function() {
    applySearchAndFilter();
});

// Select All questions (selects ALL questions in current filter, not just displayed ones)
document.getElementById('select-all-questions-btn').addEventListener('click', function() {
    // Add all filtered questions to selection
    filteredQuestions.forEach(q => {
        const id = q.id || q.ID;
        selectedQuestionIds.add(id);
    });
    // Update displayed checkboxes
    document.querySelectorAll('.question-select-checkbox').forEach(cb => {
        cb.checked = true;
        const questionItem = cb.closest('.question-item');
        if (questionItem) {
            questionItem.style.background = '#e3f2fd';
            questionItem.style.borderLeftColor = '#2196f3';
        }
    });
    updateQuestionBankStats();
    window.PoliteCCAPI.showNotification(`✅ Selected ${filteredQuestions.length} questions`, 'success');
});

// Deselect All questions
document.getElementById('deselect-all-questions-btn').addEventListener('click', function() {
    // Clear all selections
    selectedQuestionIds.clear();
    // Update displayed checkboxes
    document.querySelectorAll('.question-select-checkbox').forEach(cb => {
        cb.checked = false;
        const questionItem = cb.closest('.question-item');
        if (questionItem) {
            questionItem.style.background = '#f8f9fa';
            questionItem.style.borderLeftColor = 'var(--secondary)';
        }
    });
    updateQuestionBankStats();
    window.PoliteCCAPI.showNotification('✅ All questions deselected', 'info');
});

// Bulk Delete Selected Questions
document.getElementById('bulk-delete-questions-btn').addEventListener('click', async function() {
    if (selectedQuestionIds.size === 0) {
        window.PoliteCCAPI.showNotification('⚠️ Please select at least one question to delete', 'error');
        return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete ${selectedQuestionIds.size} selected questions?\n\nThis action cannot be undone!`);
    if (!confirmDelete) return;

    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '⏳ Deleting...';

    let successCount = 0;
    let failCount = 0;

    // Convert Set to Array for iteration
    const idsToDelete = Array.from(selectedQuestionIds);

    for (const questionId of idsToDelete) {
        try {
            if (questionId && window.PoliteCCAPI && window.PoliteCCAPI.deleteQuestionFromDatabase) {
                const success = await window.PoliteCCAPI.deleteQuestionFromDatabase(questionId);
                if (success) {
                    successCount++;
                    allQuestions = allQuestions.filter(q => q.id !== questionId);
                } else {
                    failCount++;
                }
            }
        } catch (error) {
            console.error('Delete error:', error);
            failCount++;
        }
    }

    // Clear selections and refresh
    selectedQuestionIds.clear();
    questions = allQuestions;
    applySearchAndFilter();

    btn.disabled = false;
    btn.innerHTML = '🗑️ Delete Selected';

    if (failCount > 0) {
        window.PoliteCCAPI.showNotification(`✅ Deleted ${successCount} questions. ❌ ${failCount} failed.`, 'warning');
    } else {
        window.PoliteCCAPI.showNotification(`✅ Successfully deleted ${successCount} questions!`, 'success');
    }
});

// Sanitize Question Bank (Remove Duplicates)
document.getElementById('sanitize-question-bank-btn').addEventListener('click', async function() {
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '⏳ Scanning...';

    try {
        // Find duplicates based on question text and options
        const seen = new Map();
        const duplicates = [];

        allQuestions.forEach(q => {
            // Create a unique key based on question content
            const key = `${(q.Question || '').toLowerCase().trim()}|${(q['Option A'] || '').toLowerCase().trim()}|${(q['Option B'] || '').toLowerCase().trim()}`;

            if (seen.has(key)) {
                // This is a duplicate - keep the first one (with lower ID number), delete the later one
                const existing = seen.get(key);
                const existingNum = parseInt((existing.ID || '').replace(/\D/g, '')) || 0;
                const currentNum = parseInt((q.ID || '').replace(/\D/g, '')) || 0;

                if (currentNum > existingNum) {
                    // Current question has higher ID, so it's the duplicate to delete
                    duplicates.push(q);
                } else {
                    // Existing has higher ID, replace it and mark existing as duplicate
                    duplicates.push(existing);
                    seen.set(key, q);
                }
            } else {
                seen.set(key, q);
            }
        });

        if (duplicates.length === 0) {
            btn.disabled = false;
            btn.innerHTML = '🧹 Sanitize (Remove Duplicates)';
            window.PoliteCCAPI.showNotification('✅ No duplicates found! Question bank is clean.', 'success');
            return;
        }

        const confirmDelete = confirm(`Found ${duplicates.length} duplicate questions.\n\nDo you want to remove them from the database?\n\nThis action cannot be undone!`);
        if (!confirmDelete) {
            btn.disabled = false;
            btn.innerHTML = '🧹 Sanitize (Remove Duplicates)';
            return;
        }

        btn.innerHTML = `⏳ Removing ${duplicates.length} duplicates...`;

        let successCount = 0;
        let failCount = 0;

        for (const dup of duplicates) {
            try {
                if (dup.id && window.PoliteCCAPI && window.PoliteCCAPI.deleteQuestionFromDatabase) {
                    const success = await window.PoliteCCAPI.deleteQuestionFromDatabase(dup.id);
                    if (success) {
                        successCount++;
                        allQuestions = allQuestions.filter(q => q.id !== dup.id);
                    } else {
                        failCount++;
                    }
                }
            } catch (error) {
                console.error('Sanitize delete error:', error);
                failCount++;
            }
        }

        // Refresh display
        questions = allQuestions;
        selectedQuestionIds.clear();
        applySearchAndFilter();

        btn.disabled = false;
        btn.innerHTML = '🧹 Sanitize (Remove Duplicates)';

        if (failCount > 0) {
            window.PoliteCCAPI.showNotification(`✅ Removed ${successCount} duplicates. ❌ ${failCount} failed.`, 'warning');
        } else {
            window.PoliteCCAPI.showNotification(`✅ Successfully removed ${successCount} duplicate questions!`, 'success');
        }
    } catch (error) {
        console.error('Sanitize error:', error);
        btn.disabled = false;
        btn.innerHTML = '🧹 Sanitize (Remove Duplicates)';
        window.PoliteCCAPI.showNotification('❌ Error during sanitization: ' + error.message, 'error');
    }
});

// Export questions to CSV
document.getElementById('export-questions-btn').addEventListener('click', function() {
    exportQuestionsToCSV();
});

// Function to export questions to CSV (only selected ones)
function exportQuestionsToCSV() {
    if (!allQuestions || allQuestions.length === 0) {
        window.PoliteCCAPI.showNotification('No questions to export', 'error');
        return;
    }

    if (selectedQuestionIds.size === 0) {
        window.PoliteCCAPI.showNotification('⚠️ Please select at least one question to export', 'error');
        return;
    }

    // Filter questions to only selected ones using the Set
    const selectedQuestions = allQuestions.filter(q => {
        const id = q.id || q.ID;
        return selectedQuestionIds.has(id);
    });

    // Prepare CSV content with all question details
    const headers = ['ID', 'Subject', 'Difficulty', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];
    const rows = selectedQuestions.map(q => {
        return [
            q.ID || '',
            q.Subject || '',
            q.Difficulty || 'Medium',
            q.Question || '',
            q['Option A'] || '',
            q['Option B'] || '',
            q['Option C'] || '',
            q['Option D'] || '',
            (q.Correct || q['Correct Answer'] || '').toString().toUpperCase()
        ];
    });

    // Build CSV string
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        // Escape commas, quotes, and newlines in data
        const escapedRow = row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        });
        csvContent += escapedRow.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Question_Bank_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.PoliteCCAPI.showNotification(`✅ Exported ${selectedQuestions.length} questions successfully!`, 'success');
}

// Toggle Add Question Form
document.getElementById('toggle-add-question-btn').addEventListener('click', async function() {
    const form = document.getElementById('add-question-form');
    form.classList.toggle('hidden');

    // Populate parent question dropdown when form opens
    if (!form.classList.contains('hidden')) {
        await populateParentQuestionDropdown();
    }
});

// Close Add Question Form
document.getElementById('close-add-question-btn').addEventListener('click', function() {
    document.getElementById('add-question-form').classList.add('hidden');
    resetQuestionForm();
});

// Math Syntax Help Modal - Open
document.getElementById('math-syntax-help-link').addEventListener('click', function(e) {
    e.preventDefault();
    const modal = document.getElementById('math-syntax-modal');
    modal.style.display = 'flex';
});

// Math Syntax Help Modal - Close button
document.getElementById('close-math-syntax-modal').addEventListener('click', function() {
    document.getElementById('math-syntax-modal').style.display = 'none';
});

// Math Syntax Help Modal - Close on backdrop click
document.getElementById('math-syntax-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});

// Bank child question counter
let bankChildQuestionCount = 0;

// Handle question type change for hierarchical questions
window.handleQuestionTypeChange = function() {
    const questionType = document.getElementById('question-type').value;
    const standaloneInfo = document.getElementById('standalone-question-info');
    const parentChildInfo = document.getElementById('parent-child-question-info');
    const standaloneForm = document.getElementById('standalone-form-container');
    const parentChildForm = document.getElementById('parent-child-form-container');

    if (questionType === 'parent-child') {
        // Show parent-child form
        standaloneInfo.style.display = 'none';
        parentChildInfo.style.display = 'block';
        standaloneForm.style.display = 'none';
        parentChildForm.style.display = 'block';

        // Add first child question automatically if none exist
        if (bankChildQuestionCount === 0) {
            addBankChildQuestion();
        }
    } else {
        // Show standalone form
        standaloneInfo.style.display = 'block';
        parentChildInfo.style.display = 'none';
        standaloneForm.style.display = 'block';
        parentChildForm.style.display = 'none';
    }
};

// Add child question to the bank form
function addBankChildQuestion() {
    bankChildQuestionCount++;
    const container = document.getElementById('bank-children-container');
    if (!container) return;

    const childHtml = `
        <div class="bank-child-question" id="bank-child-${bankChildQuestionCount}" style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #4caf50;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h6 style="margin: 0; color: #2e7d32; font-weight: 600;">Child Question ${bankChildQuestionCount}</h6>
                <button type="button" class="remove-bank-child-btn" onclick="removeBankChildQuestion(${bankChildQuestionCount})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>
            <div class="form-group">
                <label>Question Text</label>
                <textarea id="bank-child-question-${bankChildQuestionCount}" rows="2" placeholder="Enter the sub-question here..."></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label>Option A</label>
                    <input type="text" id="bank-child-option-a-${bankChildQuestionCount}" placeholder="Option A">
                </div>
                <div class="form-group">
                    <label>Option B</label>
                    <input type="text" id="bank-child-option-b-${bankChildQuestionCount}" placeholder="Option B">
                </div>
                <div class="form-group">
                    <label>Option C</label>
                    <input type="text" id="bank-child-option-c-${bankChildQuestionCount}" placeholder="Option C">
                </div>
                <div class="form-group">
                    <label>Option D</label>
                    <input type="text" id="bank-child-option-d-${bankChildQuestionCount}" placeholder="Option D">
                </div>
            </div>
            <div class="form-group">
                <label>Correct Answer</label>
                <select id="bank-child-correct-${bankChildQuestionCount}">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                </select>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', childHtml);
}

// Remove child question from bank form
window.removeBankChildQuestion = function(num) {
    const child = document.getElementById(`bank-child-${num}`);
    if (child) {
        child.remove();
    }
};

// Add child button handler for bank form
const bankAddChildBtn = document.getElementById('bank-add-child-btn');
if (bankAddChildBtn) {
    bankAddChildBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addBankChildQuestion();
    });
}

// Create parent-child question set from bank form
const addParentChildBtn = document.getElementById('add-parent-child-btn');
if (addParentChildBtn) {
    addParentChildBtn.addEventListener('click', async function() {
        try {
            const subject = document.getElementById('question-subject').value;
            const difficulty = document.getElementById('question-difficulty').value;
            const parentText = document.getElementById('parent-question-text').value.trim();
            const questionError = document.getElementById('question-error');
            const questionSuccess = document.getElementById('question-success');

            // Clear previous messages
            if (questionError) questionError.textContent = '';
            if (questionSuccess) questionSuccess.textContent = '';

            if (!parentText) {
                if (questionError) {
                    questionError.textContent = '❌ Please enter the parent question/passage text!';
                    setTimeout(() => { questionError.textContent = ''; }, 3000);
                }
                return;
            }

            // Collect child questions
            const childQuestions = [];
            const childElements = document.querySelectorAll('.bank-child-question');

            for (const childEl of childElements) {
                const num = childEl.id.replace('bank-child-', '');
                const childQuestion = document.getElementById(`bank-child-question-${num}`).value.trim();
                const childOptionA = document.getElementById(`bank-child-option-a-${num}`).value.trim();
                const childOptionB = document.getElementById(`bank-child-option-b-${num}`).value.trim();
                const childOptionC = document.getElementById(`bank-child-option-c-${num}`).value.trim();
                const childOptionD = document.getElementById(`bank-child-option-d-${num}`).value.trim();
                const childCorrect = document.getElementById(`bank-child-correct-${num}`).value;

                if (!childQuestion || !childOptionA || !childOptionB || !childOptionC || !childOptionD) {
                    if (questionError) {
                        questionError.textContent = `❌ Please fill in all fields for Child Question ${num}!`;
                        setTimeout(() => { questionError.textContent = ''; }, 3000);
                    }
                    return;
                }

                childQuestions.push({
                    question: childQuestion,
                    optionA: childOptionA,
                    optionB: childOptionB,
                    optionC: childOptionC,
                    optionD: childOptionD,
                    correct: childCorrect
                });
            }

            if (childQuestions.length === 0) {
                if (questionError) {
                    questionError.textContent = '❌ Please add at least one child question!';
                    setTimeout(() => { questionError.textContent = ''; }, 3000);
                }
                return;
            }

            // Disable button during creation
            this.disabled = true;
            this.textContent = 'Creating...';

            // Create parent question first
            const parentData = {
                subject: subject,
                difficulty: difficulty,
                question: parentText,
                'Question Type': 'Parent-child',
                'Main Question Text': parentText
            };

            const parentResult = await window.PoliteCCAPI.addQuestionToDatabase(parentData);

            if (!parentResult) {
                if (questionError) {
                    questionError.textContent = '❌ Failed to create parent question!';
                    setTimeout(() => { questionError.textContent = ''; }, 3000);
                }
                this.disabled = false;
                this.textContent = 'Create Parent-child Question Set';
                return;
            }

            // Create child questions linked to parent
            let childNum = 1;
            for (const child of childQuestions) {
                const childData = {
                    subject: subject,
                    difficulty: difficulty,
                    question: child.question,
                    optionA: child.optionA,
                    optionB: child.optionB,
                    optionC: child.optionC,
                    optionD: child.optionD,
                    correct: child.correct,
                    'Question Type': 'Parent-child',
                    'Parent Question': [parentResult.id],
                    'Sub Question Number': childNum
                };

                await window.PoliteCCAPI.addQuestionToDatabase(childData);
                childNum++;
            }

            // Success
            if (questionSuccess) {
                questionSuccess.textContent = `✅ Parent-child question set created with ${childQuestions.length} sub-questions!`;
                setTimeout(() => { questionSuccess.textContent = ''; }, 5000);
            }

            // Clear form
            document.getElementById('parent-question-text').value = '';
            document.getElementById('bank-children-container').innerHTML = '';
            bankChildQuestionCount = 0;
            document.getElementById('question-type').value = 'standalone';
            handleQuestionTypeChange();

            // Refresh question bank
            if (typeof loadQuestions === 'function') {
                loadQuestions();
            }

            this.disabled = false;
            this.textContent = 'Create Parent-child Question Set';

        } catch (error) {
            console.error('Error creating parent-child question set:', error);
            const questionError = document.getElementById('question-error');
            if (questionError) {
                questionError.textContent = '❌ Failed to create question set: ' + error.message;
                setTimeout(() => { questionError.textContent = ''; }, 5000);
            }
            this.disabled = false;
            this.textContent = 'Create Parent-child Question Set';
        }
    });
}

// Populate parent question dropdown with main questions
async function populateParentQuestionDropdown() {
    const select = document.getElementById('parent-question-select');
    // Skip if element doesn't exist (not using the add-to-parent feature)
    if (!select) {
        console.log('📝 parent-question-select not found, skipping dropdown population');
        return;
    }
    select.innerHTML = '<option value="">-- Loading... --</option>';

    try {
        // Get all questions that are main questions (have sub-questions or are marked as main)
        let parentQuestions = [];

        if (allQuestions && allQuestions.length > 0) {
            parentQuestions = allQuestions.filter(q => {
                // Include questions that have sub-questions or are explicitly marked as main
                const hasSubQuestions = q.subQuestions && q.subQuestions.length > 0;
                const isMainQuestion = !q['Option A'] && !q['Option B'] && q.Question; // No options = passage
                const isNotSubQuestion = q['Is Sub Question'] !== true && q['Is Sub Question'] !== 'true';
                return (hasSubQuestions || isMainQuestion) && isNotSubQuestion;
            });
        }

        select.innerHTML = '<option value="">-- Select Parent Question --</option>';

        if (parentQuestions.length === 0) {
            select.innerHTML += '<option value="" disabled>No main questions available. Create one first.</option>';
        } else {
            parentQuestions.forEach(q => {
                const truncatedText = (q.Question || '').substring(0, 60) + (q.Question && q.Question.length > 60 ? '...' : '');
                const subCount = q.subQuestions ? q.subQuestions.length : 0;
                select.innerHTML += `<option value="${q.ID}">${q.ID} (${subCount} sub-Q): ${truncatedText}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading parent questions:', error);
        select.innerHTML = '<option value="">-- Error loading questions --</option>';
    }
}

// Reset question form to default state
function resetQuestionForm() {
    // Reset question type
    document.getElementById('question-type').value = 'standalone';

    // Reset standalone form
    document.getElementById('question-text').value = '';
    document.getElementById('option-a').value = '';
    document.getElementById('option-b').value = '';
    document.getElementById('option-c').value = '';
    document.getElementById('option-d').value = '';
    document.getElementById('correct-answer').value = '0';

    // Reset parent-child form
    const parentQuestionText = document.getElementById('parent-question-text');
    if (parentQuestionText) parentQuestionText.value = '';

    const bankChildrenContainer = document.getElementById('bank-children-container');
    if (bankChildrenContainer) bankChildrenContainer.innerHTML = '';

    bankChildQuestionCount = 0;

    handleQuestionTypeChange();
}

// Add standalone question to bank
document.getElementById('add-question-btn').addEventListener('click', async function() {
    try {
        const subject = document.getElementById('question-subject').value;
        const difficulty = document.getElementById('question-difficulty').value;
        const question = document.getElementById('question-text').value.trim();
        const optionA = document.getElementById('option-a').value.trim();
        const optionB = document.getElementById('option-b').value.trim();
        const optionC = document.getElementById('option-c').value.trim();
        const optionD = document.getElementById('option-d').value.trim();
        const correct = document.getElementById('correct-answer').value;

        const questionError = document.getElementById('question-error');
        const questionSuccess = document.getElementById('question-success');

        // Clear previous messages
        if (questionError) questionError.textContent = '';
        if (questionSuccess) questionSuccess.textContent = '';

        // Validate inputs for standalone question
        if (!question) {
            if (questionError) {
                questionError.textContent = '❌ Please enter the question text!';
                setTimeout(() => { questionError.textContent = ''; }, 3000);
            }
            return;
        }

        if (!optionA || !optionB || !optionC || !optionD) {
            if (questionError) {
                questionError.textContent = '❌ Please fill in all options!';
                setTimeout(() => { questionError.textContent = ''; }, 3000);
            }
            return;
        }

        const correctAnswer = ['A', 'B', 'C', 'D'][parseInt(correct)];
        const isEditMode = this.getAttribute('data-edit-mode') === 'true';
        const editIndex = parseInt(this.getAttribute('data-edit-index'));
        const editId = this.getAttribute('data-edit-id');

        if (isEditMode) {
            // Update existing question
            if (window.PoliteCCAPI && window.PoliteCCAPI.updateQuestionInDatabase && editId) {
                const updateData = {
                    subject: subject,
                    difficulty: difficulty,
                    question: question,
                    optionA: optionA,
                    optionB: optionB,
                    optionC: optionC,
                    optionD: optionD,
                    correct: correctAnswer
                };

                const success = await window.PoliteCCAPI.updateQuestionInDatabase(editId, updateData);

                if (success) {
                    if (questionSuccess) {
                        questionSuccess.textContent = '✅ Question updated successfully!';
                        setTimeout(() => { questionSuccess.textContent = ''; }, 3000);
                    }
                }
            } else {
                // Update in local array
                questions[editIndex].Subject = subject;
                questions[editIndex].Difficulty = difficulty;
                questions[editIndex].Question = question;
                questions[editIndex]['Option A'] = optionA;
                questions[editIndex]['Option B'] = optionB;
                questions[editIndex]['Option C'] = optionC;
                questions[editIndex]['Option D'] = optionD;
                questions[editIndex].Correct = correctAnswer;

                if (questionSuccess) {
                    questionSuccess.textContent = '✅ Question updated successfully!';
                    setTimeout(() => { questionSuccess.textContent = ''; }, 3000);
                }
            }

            // Reset edit mode
            this.textContent = 'Add Question to Bank';
            this.removeAttribute('data-edit-mode');
            this.removeAttribute('data-edit-index');
            this.removeAttribute('data-edit-id');
        } else {
            // Add new standalone question to database if API is available
            if (window.PoliteCCAPI && window.PoliteCCAPI.addQuestionToDatabase) {
                const questionData = {
                    subject: subject,
                    difficulty: difficulty,
                    question: question,
                    optionA: optionA,
                    optionB: optionB,
                    optionC: optionC,
                    optionD: optionD,
                    correct: correctAnswer,
                    'Question Type': 'Standalone'
                };

                const success = await window.PoliteCCAPI.addQuestionToDatabase(questionData);

                if (success && questionSuccess) {
                    questionSuccess.textContent = '✅ Standalone question added successfully!';
                    setTimeout(() => { questionSuccess.textContent = ''; }, 3000);
                }
            } else {
                // Add to local array if no API
                const questionId = `q${questionCounter++}`;

                const newQuestion = {
                    ID: questionId,
                    Subject: subject,
                    Difficulty: difficulty,
                    Question: question,
                    'Option A': optionA,
                    'Option B': optionB,
                    'Option C': optionC,
                    'Option D': optionD,
                    Correct: correctAnswer,
                    'Question Type': 'Standalone'
                };

                questions.push(newQuestion);

                if (questionSuccess) {
                    questionSuccess.textContent = '✅ Standalone question added successfully!';
                    setTimeout(() => { questionSuccess.textContent = ''; }, 3000);
                }
            }
        }

        // Clear form
        document.getElementById('question-text').value = '';
        document.getElementById('option-a').value = '';
        document.getElementById('option-b').value = '';
        document.getElementById('option-c').value = '';
        document.getElementById('option-d').value = '';
        document.getElementById('correct-answer').value = '0';
        resetQuestionForm();

        // Refresh question list and hide form
        document.getElementById('add-question-form').classList.add('hidden');
        document.getElementById('question-bank-btn').click();
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Show create exam
document.getElementById('create-exam-btn').addEventListener('click', async function() {
    document.getElementById('question-bank-section').classList.add('hidden');
    document.getElementById('create-exam-section').classList.remove('hidden');
    document.getElementById('view-results-section').classList.add('hidden');
    document.getElementById('upload-section').classList.add('hidden');
    document.getElementById('ai-generator-section').classList.add('hidden');

    // Render exam questions list
    const examQuestionsList = document.getElementById('exam-questions-list');
    examQuestionsList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">Loading questions from database...</p>';

    // Ensure we have ALL questions from database for random selection
    if (window.PoliteCCAPI && window.PoliteCCAPI.loadQuestions) {
        const loadedQuestions = await window.PoliteCCAPI.loadQuestions() || [];
        if (loadedQuestions.length > 0) {
            allQuestions = loadedQuestions;
            // Generate unique IDs
            const seenIds = new Set();
            let maxNum = 0;
            allQuestions.forEach(q => {
                if (q.ID) {
                    const match = q.ID.match(/^[qQ](\d+)$/);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (!isNaN(num) && num > maxNum) maxNum = num;
                    }
                }
            });
            let idCounter = maxNum + 1;
            allQuestions.forEach(q => {
                if (!q.ID || seenIds.has(q.ID)) {
                    q.ID = 'Q' + String(idCounter).padStart(4, '0');
                    idCounter++;
                }
                seenIds.add(q.ID);
            });
            questions = allQuestions;
        }
    }

    if (questions.length === 0) {
        examQuestionsList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No questions available. Please add questions first!</p>';
    } else {
        // Sort questions by ID descending (latest/highest ID first)
        questions.sort((a, b) => {
            const matchA = (a.ID || '').match(/^[qQ](\d+)/);
            const matchB = (b.ID || '').match(/^[qQ](\d+)/);
            const numA = matchA ? parseInt(matchA[1]) : 0;
            const numB = matchB ? parseInt(matchB[1]) : 0;
            return numB - numA; // Descending order
        });

        // Store all questions for filtering
        let examFilteredQuestions = [...questions];

        // Function to render exam questions list with hierarchical grouping
        function renderExamQuestionsList() {
            // Group questions hierarchically - parents with their children
            const groupedQuestions = groupQuestionsHierarchically(examFilteredQuestions);

            let html = '<div id="exam-questions-container" style="max-height: 450px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 10px;">';

            if (groupedQuestions.length === 0) {
                html += '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No questions match the current filters.</p>';
            } else {
                groupedQuestions.forEach(q => {
                    const hasSubQuestions = q.subQuestions && q.subQuestions.length > 0;
                    const subQuestionCount = q.subQuestions ? q.subQuestions.length : 0;
                    const isParentQuestion = hasSubQuestions || q['Main Question Text'];

                    const subjectColors = {
                        'Math': '#3498db',
                        'Reasoning': '#9b59b6',
                        'GK': '#e67e22',
                        'General Knowledge': '#e67e22',
                        'English': '#1abc9c',
                        'Quantitative Aptitude': '#3498db',
                        'Reasoning Ability': '#9b59b6',
                        'English Language': '#1abc9c',
                        'General Awareness': '#e67e22',
                        'Current Affairs': '#e74c3c',
                        'Banking Awareness': '#27ae60',
                        'Others': '#95a5a6'
                    };
                    const difficultyColors = {
                        'Easy': '#27ae60',
                        'Medium': '#f39c12',
                        'Hard': '#e74c3c'
                    };
                    const subjectColor = subjectColors[q.Subject] || '#95a5a6';
                    const difficultyColor = difficultyColors[q.Difficulty] || '#95a5a6';

                    // Store child IDs as data attribute for group selection
                    const childIds = hasSubQuestions ? q.subQuestions.map(sq => sq.id).join(',') : '';

                    html += `
                    <label class="exam-question-item ${hasSubQuestions ? 'parent-child-group' : ''}" data-subject="${q.Subject || ''}" data-difficulty="${q.Difficulty || ''}" data-child-ids="${childIds}" data-has-children="${hasSubQuestions}" style="display: flex; align-items: flex-start; background: ${hasSubQuestions ? '#faf5ff' : '#f8f9fa'}; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; border: 2px solid ${hasSubQuestions ? '#9c27b0' : 'transparent'};">
                        <input type="checkbox" class="question-checkbox" value="${q.id}" data-question-id="${q.ID}" data-child-ids="${childIds}" data-sub-count="${subQuestionCount}" style="margin-right: 12px; margin-top: 4px; width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                                <strong style="font-size: 1rem; color: ${hasSubQuestions ? '#9c27b0' : 'var(--secondary)'};">${q.ID}</strong>
                                <span style="background: ${subjectColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${q.Subject}</span>
                                <span style="background: ${difficultyColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">${q.Difficulty || 'Unknown'}</span>
                                ${hasSubQuestions ? `
                                    <span style="background: #9c27b0; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">📋 ${subQuestionCount} Sub-Questions</span>
                                    <span style="background: #4caf50; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">⚖️ ${subQuestionCount} marks</span>
                                ` : `
                                    <span style="background: #4caf50; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">⚖️ 1 mark</span>
                                `}
                            </div>
                            <div style="color: #2c3e50; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; font-size: 0.95rem; margin-bottom: 8px;">
                                ${isParentQuestion ? '<strong>📖 Passage:</strong>' : '<strong>Q:</strong>'} ${q.Question}
                            </div>`;

                    // Show options only for standalone questions (not parent questions)
                    if (!isParentQuestion) {
                        html += `
                            <details style="margin-top: 8px; cursor: pointer;">
                                <summary style="color: #3498db; font-weight: 600; font-size: 0.85rem; user-select: none; padding: 4px 0;">Show Options</summary>
                                <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;">
                                    <div style="margin: 4px 0; color: #555;"><strong>A)</strong> ${q['Option A'] || ''}</div>
                                    <div style="margin: 4px 0; color: #555;"><strong>B)</strong> ${q['Option B'] || ''}</div>
                                    <div style="margin: 4px 0; color: #555;"><strong>C)</strong> ${q['Option C'] || ''}</div>
                                    <div style="margin: 4px 0; color: #555;"><strong>D)</strong> ${q['Option D'] || ''}</div>
                                    <div style="margin-top: 8px; padding: 6px; background: #d4edda; border-radius: 4px; color: #155724; font-weight: 600;"><strong>✓ Correct:</strong> ${(q.Correct || q['Correct Answer'] || '').toString().toUpperCase()}</div>
                                </div>
                            </details>`;
                    }

                    // Show sub-questions for parent-child groups
                    if (hasSubQuestions) {
                        html += `
                            <details style="margin-top: 10px; cursor: pointer;" open>
                                <summary style="color: #9c27b0; font-weight: 600; font-size: 0.85rem; user-select: none; padding: 4px 0;">📋 View ${subQuestionCount} Sub-Questions (All included when selected)</summary>
                                <div style="margin-top: 8px; padding: 10px; background: #f3e5f5; border-radius: 6px; border: 1px solid #ce93d8;">`;

                        q.subQuestions.forEach((sq, idx) => {
                            const sqId = sq.ID || `${q.ID}.${idx + 1}`;
                            html += `
                                    <div style="background: white; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #9c27b0;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                            <strong style="color: #9c27b0;">${sqId}</strong>
                                            <span style="background: #4caf50; color: white; padding: 1px 8px; border-radius: 10px; font-size: 0.7rem;">+1/-0.25</span>
                                        </div>
                                        <div style="color: #2c3e50; font-size: 0.9rem; margin-bottom: 6px;"><strong>Q:</strong> ${sq.Question || ''}</div>
                                        <div style="font-size: 0.85rem; color: #666;">
                                            <span style="margin-right: 10px;">A) ${sq['Option A'] || ''}</span>
                                            <span style="margin-right: 10px;">B) ${sq['Option B'] || ''}</span>
                                            <span style="margin-right: 10px;">C) ${sq['Option C'] || ''}</span>
                                            <span>D) ${sq['Option D'] || ''}</span>
                                        </div>
                                        <div style="color: #27ae60; font-size: 0.8rem; margin-top: 4px;"><strong>✓ Answer:</strong> ${(sq.Correct || sq['Correct Answer'] || '').toString().toUpperCase()}</div>
                                    </div>`;
                        });

                        html += `
                                </div>
                            </details>`;
                    }

                    html += `
                        </div>
                    </label>
                    `;
                });
            }

            html += '</div>';
            examQuestionsList.innerHTML = html;
            attachExamQuestionEventListeners();
        }

        // Update counter when checkboxes change - count actual questions (children count for parent-child)
        function updateSelectedCount() {
            let totalQuestions = 0;
            document.querySelectorAll('.question-checkbox:checked').forEach(checkbox => {
                const subCount = parseInt(checkbox.dataset.subCount) || 0;
                if (subCount > 0) {
                    // Parent-child: count the children (they are the actual questions)
                    totalQuestions += subCount;
                } else {
                    // Standalone: count as 1
                    totalQuestions += 1;
                }
            });
            const selectedCountElement = document.getElementById('selected-count-text');
            if (selectedCountElement) {
                selectedCountElement.textContent = `${totalQuestions} selected`;
            }
            // Also update the legacy element if it exists
            const legacyElement = document.getElementById('selected-count');
            if (legacyElement) {
                legacyElement.textContent = totalQuestions + ' Questions Selected';
            }
        }

        // Function to attach event listeners
        function attachExamQuestionEventListeners() {
            // Add event listeners to checkboxes
            document.querySelectorAll('.question-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', updateSelectedCount);
            });

            // Add hover effect to question items
            document.querySelectorAll('.exam-question-item').forEach(item => {
                const hasChildren = item.dataset.hasChildren === 'true';
                item.addEventListener('mouseenter', function() {
                    this.style.borderColor = hasChildren ? '#9c27b0' : 'var(--primary)';
                    this.style.background = hasChildren ? '#f3e5f5' : '#e8f4fd';
                });
                item.addEventListener('mouseleave', function() {
                    const checkbox = this.querySelector('.question-checkbox');
                    if (!checkbox.checked) {
                        this.style.borderColor = hasChildren ? '#9c27b0' : 'transparent';
                        this.style.background = hasChildren ? '#faf5ff' : '#f8f9fa';
                    }
                });
            });
        }

        // Function to apply exam question filters
        function applyExamQuestionFilters() {
            const searchTerm = document.getElementById('exam-question-search').value.toLowerCase().trim();
            const subjectFilter = document.getElementById('exam-question-filter-subject').value;
            const difficultyFilter = document.getElementById('exam-question-filter-difficulty').value;

            // Store currently checked question IDs before re-rendering
            const checkedIds = new Set();
            document.querySelectorAll('.question-checkbox:checked').forEach(cb => {
                checkedIds.add(cb.value);
            });

            examFilteredQuestions = questions.filter(q => {
                const matchesSearch = !searchTerm ||
                    (q.Question && q.Question.toLowerCase().includes(searchTerm)) ||
                    (q.ID && q.ID.toLowerCase().includes(searchTerm)) ||
                    (q['Option A'] && q['Option A'].toLowerCase().includes(searchTerm)) ||
                    (q['Option B'] && q['Option B'].toLowerCase().includes(searchTerm)) ||
                    (q['Option C'] && q['Option C'].toLowerCase().includes(searchTerm)) ||
                    (q['Option D'] && q['Option D'].toLowerCase().includes(searchTerm));

                const matchesSubject = !subjectFilter || q.Subject === subjectFilter;
                const matchesDifficulty = !difficultyFilter || q.Difficulty === difficultyFilter;

                return matchesSearch && matchesSubject && matchesDifficulty;
            });

            renderExamQuestionsList();

            // Restore checked state
            document.querySelectorAll('.question-checkbox').forEach(cb => {
                if (checkedIds.has(cb.value)) {
                    cb.checked = true;
                }
            });

            updateSelectedCount();
        }

        // Initial render
        renderExamQuestionsList();
        updateSelectedCount();

        // Add filter event listeners
        let examSearchTimeout;
        document.getElementById('exam-question-search').addEventListener('input', function() {
            clearTimeout(examSearchTimeout);
            examSearchTimeout = setTimeout(() => {
                applyExamQuestionFilters();
            }, 300);
        });

        document.getElementById('exam-question-filter-subject').addEventListener('change', function() {
            applyExamQuestionFilters();
        });

        document.getElementById('exam-question-filter-difficulty').addEventListener('change', function() {
            applyExamQuestionFilters();
        });

        // Random selection button - ADD to existing selections (counts TOTAL questions including sub-questions)
        document.getElementById('random-select-btn').addEventListener('click', function() {
            const randomCount = parseInt(document.getElementById('random-count').value);

            if (!randomCount || randomCount < 1) {
                alert('Please enter a valid number of questions to select.');
                return;
            }

            // Get visible checkboxes that are NOT already checked
            const allVisibleCheckboxes = Array.from(document.querySelectorAll('.question-checkbox'));
            const uncheckedCheckboxes = allVisibleCheckboxes.filter(cb => !cb.checked);

            if (uncheckedCheckboxes.length === 0) {
                alert('All visible questions are already selected!');
                return;
            }

            // Calculate total available questions from unchecked checkboxes (counting sub-questions)
            let totalAvailableQuestions = 0;
            uncheckedCheckboxes.forEach(cb => {
                const subCount = parseInt(cb.dataset.subCount) || 0;
                totalAvailableQuestions += (subCount > 0) ? subCount : 1;
            });

            if (randomCount > totalAvailableQuestions) {
                alert(`Only ${totalAvailableQuestions} unselected questions available. Selecting all of them.`);
            }

            // Shuffle unchecked checkboxes
            const shuffled = uncheckedCheckboxes.sort(() => Math.random() - 0.5);

            // Select checkboxes until we reach the desired TOTAL question count
            let currentTotal = 0;
            const selectedCheckboxes = [];

            for (const cb of shuffled) {
                if (currentTotal >= randomCount) break;

                const subCount = parseInt(cb.dataset.subCount) || 0;
                const questionsInThis = (subCount > 0) ? subCount : 1;

                selectedCheckboxes.push(cb);
                currentTotal += questionsInThis;
            }

            // Check the randomly selected checkboxes (ADD to existing)
            selectedCheckboxes.forEach(cb => {
                cb.checked = true;
            });

            // Update counter
            updateSelectedCount();

            // Show notification with actual count
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification(`🎲 Added ${currentTotal} questions to selection (${selectedCheckboxes.length} items)!`, 'success');
            }
        });

        // Reset selection button - clear all selections
        document.getElementById('reset-selection-btn').addEventListener('click', function() {
            const allCheckboxes = document.querySelectorAll('.question-checkbox');
            allCheckboxes.forEach(cb => {
                cb.checked = false;
            });

            // Update counter
            updateSelectedCount();

            // Show notification
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('🔄 All selections cleared!', 'info');
            }
        });

        // Cart Modal Functions
        const cartModal = document.getElementById('cart-modal');
        const cartStatsSummary = document.getElementById('cart-stats-summary');
        const cartQuestionsList = document.getElementById('cart-questions-list');
        const cartSelectedInfo = document.getElementById('cart-selected-info');

        // Function to render cart stats summary
        function renderCartStats() {
            const stats = getCartStats();

            if (stats.total === 0) {
                cartStatsSummary.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; color: #666;">
                        <span style="font-size: 2rem;">🛒</span>
                        <p style="margin-top: 10px;">Your cart is empty. Add questions from the Question Bank!</p>
                    </div>
                `;
                return;
            }

            // Subject colors
            const subjectColors = {
                'Math': '#3498db',
                'Reasoning': '#9b59b6',
                'GK': '#e67e22',
                'General Knowledge': '#e67e22',
                'English': '#1abc9c',
                'Others': '#95a5a6'
            };

            let html = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${stats.total}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Total Questions</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${stats.difficulties.Easy}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Easy</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f39c12, #f1c40f); color: white; padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${stats.difficulties.Medium}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Medium</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 15px; border-radius: 10px; text-align: center;">
                        <div style="font-size: 1.8rem; font-weight: 700;">${stats.difficulties.Hard}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Hard</div>
                    </div>
                </div>
                <h4 style="color: var(--secondary); margin-bottom: 10px;">Questions by Subject</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            `;

            for (const [subject, data] of Object.entries(stats.subjects)) {
                const color = subjectColors[subject] || '#95a5a6';
                html += `
                    <div style="background: ${color}; color: white; padding: 10px 15px; border-radius: 8px; min-width: 150px;">
                        <div style="font-weight: 700; margin-bottom: 5px;">${subject}</div>
                        <div style="font-size: 0.85rem; display: flex; gap: 8px; flex-wrap: wrap;">
                            <span>Total: ${data.total}</span>
                            <span style="opacity: 0.8;">E:${data.Easy} M:${data.Medium} H:${data.Hard}</span>
                        </div>
                    </div>
                `;
            }

            html += '</div>';
            cartStatsSummary.innerHTML = html;
        }

        // Function to render cart questions list
        function renderCartQuestions() {
            if (questionCart.size === 0) {
                cartQuestionsList.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #999;">
                        No questions in cart
                    </div>
                `;
                return;
            }

            const subjectColors = {
                'Math': '#3498db',
                'Reasoning': '#9b59b6',
                'GK': '#e67e22',
                'General Knowledge': '#e67e22',
                'English': '#1abc9c',
                'Others': '#95a5a6'
            };

            const difficultyColors = {
                'Easy': '#27ae60',
                'Medium': '#f39c12',
                'Hard': '#e74c3c'
            };

            let html = '';
            questionCart.forEach((q, key) => {
                const subjectColor = subjectColors[q.Subject] || '#95a5a6';
                const difficultyColor = difficultyColors[q.Difficulty] || '#95a5a6';

                html += `
                    <label class="cart-question-item" data-question-key="${key}" style="display: flex; align-items: flex-start; padding: 12px; border-bottom: 1px solid #e0e0e0; cursor: pointer; transition: background 0.2s;">
                        <input type="checkbox" class="cart-item-checkbox" value="${key}" data-question-id="${q.id || ''}" style="margin-right: 12px; margin-top: 4px; width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;" checked>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap;">
                                <strong style="color: var(--secondary);">${q.ID}</strong>
                                <span style="background: ${subjectColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${q.Subject}</span>
                                <span style="background: ${difficultyColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">${q.Difficulty}</span>
                                <button class="remove-from-cart-btn" data-question-key="${key}" style="background: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-left: auto;">Remove</button>
                            </div>
                            <div style="color: #555; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${q.Question}</div>
                        </div>
                    </label>
                `;
            });

            cartQuestionsList.innerHTML = html;

            // Add hover effects
            document.querySelectorAll('.cart-question-item').forEach(item => {
                item.addEventListener('mouseenter', function() {
                    this.style.background = '#f0f8ff';
                });
                item.addEventListener('mouseleave', function() {
                    this.style.background = 'transparent';
                });
            });

            // Add remove button handlers
            document.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const key = this.getAttribute('data-question-key');
                    questionCart.delete(key);
                    updateQuestionBankStats();
                    renderCartStats();
                    renderCartQuestions();
                    updateCartSelectedInfo();
                    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                        window.PoliteCCAPI.showNotification('Removed from cart', 'info');
                    }
                });
            });

            // Add checkbox change handlers
            document.querySelectorAll('.cart-item-checkbox').forEach(cb => {
                cb.addEventListener('change', updateCartSelectedInfo);
            });

            updateCartSelectedInfo();
        }

        // Function to update cart selected info
        function updateCartSelectedInfo() {
            const checkedCount = document.querySelectorAll('.cart-item-checkbox:checked').length;
            cartSelectedInfo.textContent = `${checkedCount} questions selected`;
        }

        // Show cart modal
        document.getElementById('show-cart-btn').addEventListener('click', function() {
            renderCartStats();
            renderCartQuestions();
            cartModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        // Close cart modal
        document.getElementById('close-cart-modal-btn').addEventListener('click', function() {
            cartModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });

        // Close modal when clicking outside
        cartModal.addEventListener('click', function(e) {
            if (e.target === cartModal) {
                cartModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });

        // Select all in cart
        document.getElementById('cart-select-all-btn').addEventListener('click', function() {
            document.querySelectorAll('.cart-item-checkbox').forEach(cb => {
                cb.checked = true;
            });
            updateCartSelectedInfo();
        });

        // Deselect all in cart
        document.getElementById('cart-deselect-all-btn').addEventListener('click', function() {
            document.querySelectorAll('.cart-item-checkbox').forEach(cb => {
                cb.checked = false;
            });
            updateCartSelectedInfo();
        });

        // Clear cart
        document.getElementById('cart-clear-btn').addEventListener('click', function() {
            if (questionCart.size === 0) {
                if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                    window.PoliteCCAPI.showNotification('Cart is already empty', 'info');
                }
                return;
            }

            if (confirm(`Are you sure you want to clear all ${questionCart.size} questions from cart?`)) {
                clearCart();
                renderCartStats();
                renderCartQuestions();
                // Also refresh the question bank display to update cart button states
                if (filteredQuestions.length > 0) {
                    applySearchAndFilter();
                }
                if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                    window.PoliteCCAPI.showNotification('Cart cleared', 'success');
                }
            }
        });

        // Add selected cart items to exam
        document.getElementById('add-cart-to-exam-btn').addEventListener('click', function() {
            const selectedKeys = [];
            document.querySelectorAll('.cart-item-checkbox:checked').forEach(cb => {
                selectedKeys.push(cb.value);
            });

            if (selectedKeys.length === 0) {
                if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                    window.PoliteCCAPI.showNotification('Please select at least one question to add', 'warning');
                }
                return;
            }

            // Find and check the corresponding question checkboxes in the exam questions list
            let addedCount = 0;
            selectedKeys.forEach(key => {
                const q = questionCart.get(key);
                if (q) {
                    // Find the checkbox with matching question id
                    const examCheckbox = document.querySelector(`.question-checkbox[value="${q.id}"]`);
                    if (examCheckbox && !examCheckbox.checked) {
                        examCheckbox.checked = true;
                        addedCount++;
                    }
                }
            });

            // Update counter
            updateSelectedCount();

            // Close modal
            cartModal.style.display = 'none';
            document.body.style.overflow = 'auto';

            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification(`Added ${addedCount} questions to exam selection`, 'success');
            }
        });
    }
});

// Create exam
document.getElementById('create-exam-submit-btn').addEventListener('click', async function() {
    try {
        const examCode = document.getElementById('exam-code').value.trim().toUpperCase();
        const examTitle = document.getElementById('exam-title').value.trim();
        const duration = parseInt(document.getElementById('exam-duration').value);
        const expiryInput = document.getElementById('exam-expiry').value;

        if (!examCode || !examTitle || isNaN(duration) || duration < 5) {
            const examError = document.getElementById('exam-error');
            if (examError) {
                examError.textContent = '❌ Please fill all fields correctly!';
                setTimeout(() => {
                    examError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Validate expiry date
        if (!expiryInput) {
            const examError = document.getElementById('exam-error');
            if (examError) {
                examError.textContent = '❌ Please select an expiry date!';
                setTimeout(() => {
                    examError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Parse date from dd-mm-yyyy format
        let expiryDate;
        let formattedExpiryForBackend;

        // Check if date is in dd-mm-yyyy format
        const ddmmyyyyMatch = expiryInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // JS months are 0-indexed
            const year = parseInt(ddmmyyyyMatch[3], 10);
            expiryDate = new Date(year, month, day, 23, 59, 59);
            formattedExpiryForBackend = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else {
            // Try YYYY-MM-DD format as fallback
            expiryDate = new Date(expiryInput + 'T23:59:59');
            formattedExpiryForBackend = expiryInput;
        }

        // Check if the expiry date is valid
        if (isNaN(expiryDate.getTime())) {
            const examError = document.getElementById('exam-error');
            if (examError) {
                examError.textContent = '❌ Invalid expiry date! Use format: dd-mm-yyyy';
                setTimeout(() => {
                    examError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Check if expiry date is today or in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDateOnly = new Date(expiryDate);
        expiryDateOnly.setHours(0, 0, 0, 0);
        if (expiryDateOnly.getTime() < today.getTime()) {
            const examError = document.getElementById('exam-error');
            if (examError) {
                examError.textContent = '❌ Expiry date must be today or in the future!';
                setTimeout(() => {
                    examError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Get selected questions - include both parent and child question IDs
        const checkboxes = document.querySelectorAll('.question-checkbox:checked');
        const selectedQuestions = [];

        // For each selected checkbox, add the question ID and any child IDs
        checkboxes.forEach(cb => {
            // Add the parent/standalone question ID
            selectedQuestions.push(cb.value);

            // If this is a parent-child group, also add child question IDs
            const childIds = cb.dataset.childIds;
            if (childIds && childIds.trim()) {
                const childIdArray = childIds.split(',').filter(id => id.trim());
                childIdArray.forEach(childId => {
                    if (!selectedQuestions.includes(childId)) {
                        selectedQuestions.push(childId);
                    }
                });
            }
        });

        // Count total questions including sub-questions (for minimum validation)
        let totalQuestionCount = 0;
        checkboxes.forEach(cb => {
            const subCount = parseInt(cb.dataset.subCount) || 0;
            if (subCount > 0) {
                // Parent-child: count the children (they are the actual questions)
                totalQuestionCount += subCount;
            } else {
                // Standalone: count as 1
                totalQuestionCount += 1;
            }
        });

        if (totalQuestionCount < 5) {
            const examError = document.getElementById('exam-error');
            if (examError) {
                examError.textContent = `❌ Please select at least 5 questions! (Currently: ${totalQuestionCount})`;
                setTimeout(() => {
                    examError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Create exam object - use 'Questions' to match Airtable field name
        const newExam = {
            'Exam Code': examCode,
            'Title': examTitle,
            'Duration (mins)': duration,
            'Expiry (IST)': formattedExpiryForBackend,
            'Questions': selectedQuestions
        };

        // Save to database if API is available
        if (window.PoliteCCAPI && window.PoliteCCAPI.createExamInDatabase) {
            const success = await window.PoliteCCAPI.createExamInDatabase(newExam);

            if (success) {
                // Show success
                const examSuccess = document.getElementById('exam-success');
                if (examSuccess) {
                    examSuccess.textContent = `✅ Exam "${examCode}" created and saved successfully!`;
                    setTimeout(() => {
                        examSuccess.textContent = '';
                    }, 5000);
                }

                // Clear form
                document.getElementById('exam-code').value = '';
                document.getElementById('exam-title').value = '';
                document.getElementById('exam-duration').value = '';
                document.getElementById('exam-expiry').value = '';

                // Uncheck all checkboxes
                document.querySelectorAll('.question-checkbox').forEach(cb => cb.checked = false);
                document.getElementById('selected-count').textContent = '0 Selected';
            }
        } else {
            // Fallback: Add to local array if API not available
            exams.push(newExam);

            // Show success
            const examSuccess = document.getElementById('exam-success');
            if (examSuccess) {
                examSuccess.textContent = `✅ Exam "${examCode}" created successfully!`;
                setTimeout(() => {
                    examSuccess.textContent = '';
                }, 5000);
            }

            // Show notification
            const notification = document.createElement('div');
            notification.className = 'notification success';
            notification.innerHTML = `✅ Exam "${examCode}" created successfully!`;
            document.getElementById('notification-container').appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Global variable to store current results for export
let currentExamResults = [];
let currentExamCodeForResults = '';

// Show view results - New redesigned dashboard
document.getElementById('view-results-btn').addEventListener('click', async function() {
    try {
        document.getElementById('question-bank-section').classList.add('hidden');
        document.getElementById('create-exam-section').classList.add('hidden');
        document.getElementById('view-results-section').classList.remove('hidden');
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('ai-generator-section').classList.add('hidden');

        // Show main view, hide candidates view
        document.getElementById('results-main-view').classList.remove('hidden');
        document.getElementById('results-candidates-view').classList.add('hidden');

        // Load exams and questions
        if (window.PoliteCCAPI && window.PoliteCCAPI.loadExams) {
            exams = await window.PoliteCCAPI.loadExams() || exams;
        }

        if (window.PoliteCCAPI && window.PoliteCCAPI.loadQuestions) {
            questions = await window.PoliteCCAPI.loadQuestions() || questions;
        }

        // Calculate stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let activeCount = 0;
        let expiredCount = 0;

        exams.forEach(exam => {
            const expiryDate = exam['Expiry (IST)'] ? new Date(exam['Expiry (IST)']) : null;
            if (expiryDate) {
                expiryDate.setHours(0, 0, 0, 0);
                if (expiryDate.getTime() >= today.getTime()) {
                    activeCount++;
                } else {
                    expiredCount++;
                }
            } else {
                activeCount++; // No expiry means active
            }
        });

        document.getElementById('total-exams-count').textContent = exams.length;
        document.getElementById('active-exams-count').textContent = activeCount;
        document.getElementById('expired-exams-count').textContent = expiredCount;

        // Display exams in grid - use results-list container in the visible view-results-section
        const examsContainer = document.getElementById('results-list');

        if (exams.length === 0) {
            examsContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1; padding: 40px;">No exams found. Create an exam first.</p>';
            return;
        }

        // Fetch results count for all exams in parallel
        const examResultCounts = {};
        if (window.PoliteCCAPI && window.PoliteCCAPI.getExamResults) {
            const resultsPromises = exams.map(async (exam) => {
                const examCode = exam['Exam Code'] || exam.examCode;
                try {
                    const results = await window.PoliteCCAPI.getExamResults(examCode) || [];
                    examResultCounts[examCode] = results.length;
                } catch (e) {
                    examResultCounts[examCode] = 0;
                }
            });
            await Promise.all(resultsPromises);
        }

        let examsHTML = '';
        for (const exam of exams) {
            const examCode = exam['Exam Code'] || exam.examCode;
            const title = exam['Title'] || exam.title || 'Untitled';
            const expiryDate = exam['Expiry (IST)'] ? new Date(exam['Expiry (IST)']) : null;
            const expiryStr = exam['Expiry (IST)'] ? formatDateForDisplay(exam['Expiry (IST)']) : 'No Expiry';

            let isExpired = false;
            if (expiryDate) {
                expiryDate.setHours(0, 0, 0, 0);
                isExpired = expiryDate.getTime() < today.getTime();
            }

            const statusBadge = isExpired
                ? '<span style="background: #e74c3c; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">EXPIRED</span>'
                : '<span style="background: #27ae60; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">ACTIVE</span>';

            // 'Questions' is the correct Airtable field name for linked records
            const questionIds = exam['Questions'] || exam['Question IDs'] || exam['QuestionIDs'] || exam.questionIds || [];
            // Calculate actual scorable questions count
            // A scorable question has options (Option A) OR is a parent with subQuestions
            let questionCount = 0;
            const idsArray = Array.isArray(questionIds) ? questionIds : (typeof questionIds === 'string' && questionIds.trim() ? questionIds.split(',').filter(id => id.trim()) : []);
            const countedIds = new Set(); // Track counted question IDs to avoid double counting

            idsArray.forEach(qId => {
                const q = questions.find(question => question.id === qId || question.ID === qId);
                if (q) {
                    // If this is a parent with subQuestions, count the subQuestions (they might not be linked separately)
                    if (q.subQuestions && q.subQuestions.length > 0) {
                        q.subQuestions.forEach(sq => {
                            const sqId = sq.id || sq.ID;
                            if (!countedIds.has(sqId)) {
                                countedIds.add(sqId);
                                questionCount += 1;
                            }
                        });
                    } else if (q['Option A'] && q['Option A'].trim() !== '') {
                        // Standalone or child question with options
                        if (!countedIds.has(qId)) {
                            countedIds.add(qId);
                            questionCount += 1;
                        }
                    }
                    // Parent passages without options and without loaded subQuestions are not counted
                } else {
                    // Question not found in local cache, count as 1 (assume it's scorable)
                    if (!countedIds.has(qId)) {
                        countedIds.add(qId);
                        questionCount += 1;
                    }
                }
            });
            const duration = exam['Duration (mins)'] || exam['Duration'] || exam.duration || 60;
            const candidateCount = examResultCounts[examCode] || 0;

            examsHTML += `
                <div class="exam-result-card" data-exam-code="${examCode}" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 3px 15px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s; border: 2px solid transparent;" onmouseenter="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'; this.style.borderColor='var(--secondary)';" onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 15px rgba(0,0,0,0.1)'; this.style.borderColor='transparent';">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--secondary);">${examCode}</div>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 1rem; color: #333; margin-bottom: 15px; font-weight: 500;">${title}</div>
                    <div style="display: flex; justify-content: center; margin-bottom: 12px;">
                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 25px; border-radius: 10px; text-align: center; min-width: 100px;">
                            <div style="font-size: 1.8rem; font-weight: 700;">${candidateCount}</div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">Candidates</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; color: #666;">
                        <div><strong>Expiry:</strong> ${expiryStr}</div>
                        <div><strong>Duration:</strong> ${duration} min</div>
                        <div><strong>Questions:</strong> ${questionCount}</div>
                        <div style="color: var(--primary); font-weight: 600;">Click to view results →</div>
                    </div>
                </div>
            `;
        }

        // Wrap in a grid container for proper display
        examsContainer.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">${examsHTML}</div>`;

        // Add click handlers for exam cards
        document.querySelectorAll('.exam-result-card').forEach(card => {
            card.addEventListener('click', function() {
                const examCode = this.getAttribute('data-exam-code');
                showExamCandidates(examCode);
            });
        });

    } catch (error) {
        console.error('❌ Event handler error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ An error occurred: ' + error.message, 'error');
        }
    }
});

// Function to show candidates for a selected exam
async function showExamCandidates(examCode) {
    try {
        // Show the results detail modal
        const modal = document.getElementById('results-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // Show main view with candidates, hide detail content
        document.getElementById('results-main-view').classList.remove('hidden');
        document.getElementById('results-detail-content').classList.add('hidden');
        document.getElementById('back-to-exams-btn').classList.add('hidden');

        // Get exam details
        const exam = exams.find(e => (e['Exam Code'] || e.examCode) === examCode);
        const title = exam ? (exam['Title'] || exam.title || 'Untitled') : 'Unknown';
        const expiryDateStr = exam && exam['Expiry (IST)'] ? formatDateForDisplay(exam['Expiry (IST)']) : 'No Expiry';
        const duration = exam ? (exam['Duration (mins)'] || exam['Duration'] || exam.duration || 60) : 60;
        // 'Questions' is the correct Airtable field name for linked records
        const examQuestionIds = exam ? (exam['Questions'] || exam['Question IDs'] || exam['QuestionIDs'] || exam.questionIds || []) : [];
        // Calculate actual scorable questions count
        // A scorable question has options (Option A) OR is a parent with subQuestions
        let questionCount = 0;
        const idsArray = Array.isArray(examQuestionIds) ? examQuestionIds : (typeof examQuestionIds === 'string' && examQuestionIds.trim() ? examQuestionIds.split(',').filter(id => id.trim()) : []);
        const countedIds = new Set(); // Track counted question IDs to avoid double counting

        idsArray.forEach(qId => {
            const q = questions.find(question => question.id === qId || question.ID === qId);
            if (q) {
                // If this is a parent with subQuestions, count the subQuestions
                if (q.subQuestions && q.subQuestions.length > 0) {
                    q.subQuestions.forEach(sq => {
                        const sqId = sq.id || sq.ID;
                        if (!countedIds.has(sqId)) {
                            countedIds.add(sqId);
                            questionCount += 1;
                        }
                    });
                } else if (q['Option A'] && q['Option A'].trim() !== '') {
                    // Standalone or child question with options
                    if (!countedIds.has(qId)) {
                        countedIds.add(qId);
                        questionCount += 1;
                    }
                }
            } else {
                // Question not found in local cache, count as 1
                if (!countedIds.has(qId)) {
                    countedIds.add(qId);
                    questionCount += 1;
                }
            }
        });

        document.getElementById('selected-exam-title').textContent = `${examCode} - ${title}`;
        document.getElementById('selected-exam-info').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; margin-bottom: 20px;">
                <div><strong>Exam Code:</strong> ${examCode}</div>
                <div><strong>Title:</strong> ${title}</div>
                <div><strong>Expiry:</strong> ${expiryDateStr}</div>
                <div><strong>Duration:</strong> ${duration} min</div>
                <div><strong>Questions:</strong> ${questionCount}</div>
            </div>
        `;

        // Use the candidates view inside the modal
        const candidatesContainer = document.getElementById('results-candidates-view');
        candidatesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">Loading candidates...</p>';

        // Get results from API
        let results = [];
        if (window.PoliteCCAPI && window.PoliteCCAPI.getExamResults) {
            results = await window.PoliteCCAPI.getExamResults(examCode) || [];
        }

        // Store for export
        currentExamResults = results;
        currentExamCodeForResults = examCode;

        if (results.length === 0) {
            candidatesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">No candidates have taken this exam yet.</p>';
            return;
        }

        // Sort by score (highest first)
        results.sort((a, b) => (b.Score || b.score || 0) - (a.Score || a.score || 0));

        // Build candidates list with better layout
        let candidatesHTML = `
            <h4 style="margin-bottom: 15px; color: var(--primary); font-weight: 600;">
                📋 Candidates (${results.length} total) - Sorted by Rank
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; max-height: 400px; overflow-y: auto; padding: 5px;">
        `;

        results.forEach((result, index) => {
            const name = result.Name || result.name || 'Unknown';
            const score = parseFloat(result.Score || result.score || 0);
            const mobile = result.Mobile || result.mobile || 'N/A';
            const submittedAt = result['Submitted At'] || result.submittedAt || '';
            const dateStr = submittedAt ? formatDateForDisplay(submittedAt) : 'N/A';

            const scoreColor = score >= 0 ? '#27ae60' : '#e74c3c';
            const scoreBg = score >= 0 ? '#e8f5e9' : '#ffebee';
            const rankBadge = index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`;

            candidatesHTML += `
                <div class="candidate-result-card" data-result-index="${index}" style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; transition: all 0.2s; border: 2px solid #e0e0e0;" onmouseenter="this.style.transform='translateY(-2px)'; this.style.borderColor='var(--primary)';" onmouseleave="this.style.transform='translateY(0)'; this.style.borderColor='#e0e0e0';">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: 700; font-size: 1rem; color: #333;">${rankBadge} ${name}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="flex: 1;">
                            <div style="font-size: 0.8rem; color: #666;"><strong>Mobile:</strong> ${mobile}</div>
                            <div style="font-size: 0.8rem; color: #666;"><strong>Date:</strong> ${dateStr}</div>
                        </div>
                        <div style="background: ${scoreBg}; padding: 10px 15px; border-radius: 8px; text-align: center; border-left: 3px solid ${scoreColor};">
                            <div style="font-size: 1.4rem; font-weight: 700; color: ${scoreColor};">${score.toFixed(2)}</div>
                            <div style="font-size: 0.7rem; color: #666;">Score</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; text-align: center; color: var(--primary); font-size: 0.8rem; font-weight: 600; padding-top: 8px; border-top: 1px solid #eee;">
                        Click for detailed results →
                    </div>
                </div>
            `;
        });

        candidatesHTML += '</div>';
        candidatesContainer.innerHTML = candidatesHTML;

        // Add click handlers for candidate cards
        candidatesContainer.querySelectorAll('.candidate-result-card').forEach(card => {
            card.addEventListener('click', function() {
                const resultIndex = parseInt(this.getAttribute('data-result-index'));
                showCandidateDetailedResults(results[resultIndex], examCode);
            });
        });

    } catch (error) {
        console.error('❌ Error loading candidates:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ Failed to load candidates: ' + error.message, 'error');
        }
    }
}

// Function to show detailed results for a candidate with full questions and options
function showCandidateDetailedResults(result, examCode) {
    const modal = document.getElementById('results-detail-modal');
    const content = document.getElementById('results-detail-content');

    // Hide main view and show detail content
    document.getElementById('results-main-view').classList.add('hidden');
    content.classList.remove('hidden');
    document.getElementById('back-to-exams-btn').classList.remove('hidden');

    const name = result.Name || result.name || 'Unknown';
    const score = parseFloat(result.Score || result.score || 0);
    const mobile = result.Mobile || result.mobile || 'N/A';
    const submittedAt = result['Submitted At'] || result.submittedAt || '';
    const dateStr = submittedAt ? new Date(submittedAt).toLocaleString('en-IN') : 'N/A';

    // Parse user answers
    let userAnswers = [];
    try {
        userAnswers = typeof result.Answers === 'string' ? JSON.parse(result.Answers) : result.Answers || [];
    } catch (e) {
        console.error('Error parsing answers:', e);
        userAnswers = result.answers || [];
    }

    // Build header
    let html = `
        <h3 style="color: var(--secondary); margin-bottom: 20px; font-size: 1.4rem;">Detailed Result: ${name}</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 12px;">
            <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Exam Code</div>
                <div style="font-weight: 700; color: var(--secondary);">${examCode}</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Mobile</div>
                <div style="font-weight: 700; color: #333;">${mobile}</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Final Score</div>
                <div style="font-weight: 700; font-size: 1.3rem; color: ${score >= 0 ? '#27ae60' : '#e74c3c'};">${score.toFixed(2)}</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Submitted On</div>
                <div style="font-weight: 700; color: #333; font-size: 0.9rem;">${dateStr}</div>
            </div>
        </div>
    `;

    // Check if we have answer data
    if (!userAnswers || userAnswers.length === 0) {
        html += `
            <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 12px; border-left: 4px solid #ffc107;">
                <div style="font-size: 2.5rem; margin-bottom: 15px;">⚠️</div>
                <h4 style="color: #856404; margin-bottom: 10px;">No Answer Data Available</h4>
                <p style="color: #856404;">This result does not contain detailed answer information.</p>
            </div>
        `;
        content.innerHTML = html;
        modal.style.display = 'flex';
        return;
    }

    // Calculate statistics
    const isDetailedFormat = userAnswers.length > 0 && typeof userAnswers[0] === 'object' && userAnswers[0] !== null;
    let correctCount = 0, incorrectCount = 0, unansweredCount = 0;

    if (isDetailedFormat) {
        userAnswers.forEach(answer => {
            if (answer.isCorrect) correctCount++;
            else if (answer.userAnswer !== 'Not Answered') incorrectCount++;
            else unansweredCount++;
        });
    }

    html += `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
            <div style="text-align: center; padding: 15px; background: #e8f5e9; border-radius: 10px; border-left: 4px solid #27ae60;">
                <div style="font-size: 1.8rem; font-weight: 700; color: #27ae60;">${correctCount}</div>
                <div style="font-size: 0.85rem; color: #388e3c;">Correct</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #ffebee; border-radius: 10px; border-left: 4px solid #e74c3c;">
                <div style="font-size: 1.8rem; font-weight: 700; color: #e74c3c;">${incorrectCount}</div>
                <div style="font-size: 0.85rem; color: #c62828;">Incorrect</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f5f5f5; border-radius: 10px; border-left: 4px solid #95a5a6;">
                <div style="font-size: 1.8rem; font-weight: 700; color: #666;">${unansweredCount}</div>
                <div style="font-size: 0.85rem; color: #666;">Unanswered</div>
            </div>
        </div>
        <h4 style="color: var(--primary); margin-bottom: 15px; font-size: 1.1rem;">Question-wise Breakdown</h4>
        <div style="max-height: 450px; overflow-y: auto; padding-right: 10px;">
    `;

    // Display questions with full details and all options - GROUP parent-child questions together
    if (isDetailedFormat) {
        // First, group questions: separate parents/standalone from children
        const parentChildMap = new Map(); // parentId -> {parent, children}
        const standaloneQuestions = [];

        userAnswers.forEach((answer, index) => {
            answer._originalIndex = index; // Store original index for numbering
            const isSubQuestion = answer.isSubQuestion;
            const parentQuestionId = answer.parentQuestionId;

            if (isSubQuestion && parentQuestionId) {
                // This is a child question
                if (!parentChildMap.has(parentQuestionId)) {
                    parentChildMap.set(parentQuestionId, { parent: null, children: [] });
                }
                parentChildMap.get(parentQuestionId).children.push(answer);
            } else if (answer.isParentQuestion || answer.hasSubQuestions) {
                // This is a parent/passage question
                const qId = answer.questionId;
                if (!parentChildMap.has(qId)) {
                    parentChildMap.set(qId, { parent: answer, children: [] });
                } else {
                    parentChildMap.get(qId).parent = answer;
                }
            } else {
                // Standalone question
                standaloneQuestions.push(answer);
            }
        });

        // Also check if any children don't have their parent in the map (parent might be identified differently)
        userAnswers.forEach(answer => {
            if (!answer.isSubQuestion && !answer.isParentQuestion && !answer.hasSubQuestions) {
                // Check if this might be a parent based on ID matching
                const qId = answer.questionId;
                if (parentChildMap.has(qId) && !parentChildMap.get(qId).parent) {
                    parentChildMap.get(qId).parent = answer;
                    // Remove from standalone
                    const idx = standaloneQuestions.indexOf(answer);
                    if (idx > -1) standaloneQuestions.splice(idx, 1);
                }
            }
        });

        // Helper function to render a single question's answer with rich content support
        function renderQuestionAnswer(answer, qNumber, isChild = false) {
            const isCorrect = answer.isCorrect;
            const userAnswered = answer.userAnswer !== 'Not Answered';
            const userAnswerLetter = answer.userAnswer;
            const correctAnswerLetter = answer.correctAnswer;
            const bgColor = isCorrect ? '#e8f5e9' : (userAnswered ? '#ffebee' : '#f5f5f5');
            const borderColor = isCorrect ? '#27ae60' : (userAnswered ? '#e74c3c' : '#95a5a6');

            // Use escapeHtmlForRichContent to preserve math delimiters
            const questionText = escapeHtmlForRichContent(answer.question || 'Question not available');
            const optA = escapeHtmlForRichContent(answer.optionA || '');
            const optB = escapeHtmlForRichContent(answer.optionB || '');
            const optC = escapeHtmlForRichContent(answer.optionC || '');
            const optD = escapeHtmlForRichContent(answer.optionD || '');

            return `
                <div style="background: ${bgColor}; border-left: 5px solid ${isChild ? '#9c27b0' : borderColor}; padding: 15px; margin-bottom: 10px; border-radius: 8px; ${isChild ? 'margin-left: 20px;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: 700; color: ${isChild ? '#9c27b0' : 'var(--secondary)'}; font-size: 0.95rem;">
                            ${qNumber}. ${answer.questionId || ''}
                            ${isChild ? `<span style="background: #e1bee7; color: #7b1fa2; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 6px;">Sub-Q</span>` : ''}
                            <span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; margin-left: 6px;">${answer.subject || ''}</span>
                        </div>
                        <div style="font-weight: 600; font-size: 0.85rem; padding: 4px 10px; border-radius: 6px; background: ${isCorrect ? '#c8e6c9' : (userAnswered ? '#ffcdd2' : '#e0e0e0')}; color: ${isCorrect ? '#388e3c' : (userAnswered ? '#c62828' : '#666')};">
                            ${isCorrect ? '+1' : (userAnswered ? '-0.25' : '0')}
                        </div>
                    </div>
                    <div class="rich-content" style="font-size: 1rem; line-height: 1.6; margin-bottom: 12px; color: #333; background: white; padding: 12px; border-radius: 6px;">
                        ${questionText}
                    </div>
                    <div style="display: grid; gap: 6px; font-size: 0.95rem;">
                        <div style="padding: 10px 12px; border-radius: 6px; background: ${userAnswerLetter === 'A' ? (correctAnswerLetter === 'A' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'A' ? '#c8e6c9' : 'white')}; border: 2px solid ${correctAnswerLetter === 'A' ? '#27ae60' : (userAnswerLetter === 'A' ? '#e74c3c' : '#e0e0e0')};">
                            <strong>A:</strong> <span class="rich-content">${optA}</span> ${userAnswerLetter === 'A' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'A' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                        </div>
                        <div style="padding: 10px 12px; border-radius: 6px; background: ${userAnswerLetter === 'B' ? (correctAnswerLetter === 'B' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'B' ? '#c8e6c9' : 'white')}; border: 2px solid ${correctAnswerLetter === 'B' ? '#27ae60' : (userAnswerLetter === 'B' ? '#e74c3c' : '#e0e0e0')};">
                            <strong>B:</strong> <span class="rich-content">${optB}</span> ${userAnswerLetter === 'B' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'B' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                        </div>
                        <div style="padding: 10px 12px; border-radius: 6px; background: ${userAnswerLetter === 'C' ? (correctAnswerLetter === 'C' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'C' ? '#c8e6c9' : 'white')}; border: 2px solid ${correctAnswerLetter === 'C' ? '#27ae60' : (userAnswerLetter === 'C' ? '#e74c3c' : '#e0e0e0')};">
                            <strong>C:</strong> <span class="rich-content">${optC}</span> ${userAnswerLetter === 'C' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'C' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                        </div>
                        <div style="padding: 10px 12px; border-radius: 6px; background: ${userAnswerLetter === 'D' ? (correctAnswerLetter === 'D' ? '#c8e6c9' : '#ffcdd2') : (correctAnswerLetter === 'D' ? '#c8e6c9' : 'white')}; border: 2px solid ${correctAnswerLetter === 'D' ? '#27ae60' : (userAnswerLetter === 'D' ? '#e74c3c' : '#e0e0e0')};">
                            <strong>D:</strong> <span class="rich-content">${optD}</span> ${userAnswerLetter === 'D' ? '<span style="color: #1976d2; font-weight: 600; margin-left: 8px;">(Your Answer)</span>' : ''} ${correctAnswerLetter === 'D' ? '<span style="color: #388e3c; font-weight: 600; margin-left: 8px;">✓ Correct</span>' : ''}
                        </div>
                    </div>
                    <div style="margin-top: 10px; font-weight: 600; font-size: 0.9rem; text-align: right;">
                        ${isCorrect ? '✅ Correct' : (userAnswered ? '❌ Incorrect' : '⚪ Unanswered')}
                    </div>
                </div>
            `;
        }

        let questionNumber = 1;

        // Render parent-child groups first
        parentChildMap.forEach((group, parentId) => {
            const parent = group.parent;
            const children = group.children;

            if (children.length > 0) {
                // Calculate group score
                let groupCorrect = 0, groupIncorrect = 0, groupUnanswered = 0;
                children.forEach(child => {
                    if (child.isCorrect) groupCorrect++;
                    else if (child.userAnswer !== 'Not Answered') groupIncorrect++;
                    else groupUnanswered++;
                });
                const groupScore = groupCorrect - (groupIncorrect * 0.25);

                // Render group container
                html += `
                    <div style="background: #faf5ff; border: 2px solid #9c27b0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <!-- Group Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                            <div style="font-weight: 700; color: #9c27b0; font-size: 1.1rem;">
                                📋 Q${questionNumber}. ${parentId || 'Parent-Child Group'}
                                <span style="background: #9c27b0; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; margin-left: 8px;">${children.length} Sub-Questions</span>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <span style="background: #c8e6c9; color: #388e3c; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">✓ ${groupCorrect}</span>
                                <span style="background: #ffcdd2; color: #c62828; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">✗ ${groupIncorrect}</span>
                                <span style="background: #e0e0e0; color: #666; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">○ ${groupUnanswered}</span>
                                <span style="background: ${groupScore >= 0 ? '#4caf50' : '#f44336'}; color: white; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 700;">Score: ${groupScore.toFixed(2)}</span>
                            </div>
                        </div>

                        <!-- Parent Passage with rich content support -->
                        ${parent ? `
                        <div style="background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="color: #9c27b0; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem;">📖 Passage/Context:</div>
                            <div class="rich-content" style="color: #333; font-size: 1rem; line-height: 1.7;">${escapeHtmlForRichContent(parent.question || 'Passage not available')}</div>
                        </div>
                        ` : ''}

                        <!-- Child Questions -->
                        <div style="border-top: 2px dashed #ce93d8; padding-top: 15px;">
                            <div style="color: #7b1fa2; font-weight: 600; margin-bottom: 12px; font-size: 0.9rem;">Sub-Questions:</div>
                `;

                // Render each child
                children.sort((a, b) => (a.subQuestionOrder || 0) - (b.subQuestionOrder || 0));
                children.forEach((child, childIdx) => {
                    html += renderQuestionAnswer(child, `${questionNumber}.${childIdx + 1}`, true);
                });

                html += `
                        </div>
                    </div>
                `;
                questionNumber++;
            }
        });

        // Render standalone questions
        standaloneQuestions.forEach(answer => {
            html += renderQuestionAnswer(answer, `Q${questionNumber}`, false);
            questionNumber++;
        });
    } else {
        html += `
            <div style="text-align: center; padding: 30px; background: #fff3cd; border-radius: 12px;">
                <p style="color: #856404;">Legacy answer format detected. Full question details are not available.</p>
            </div>
        `;
    }

    html += '</div>';
    content.innerHTML = html;

    // Process rich content (render math expressions) in the results modal
    processRichContentInContainer(content);

    // Ensure modal is visible (should already be open from showExamCandidates)
    modal.style.display = 'flex';
}

// Back to candidates button handler
document.getElementById('back-to-exams-btn').addEventListener('click', function() {
    // Show main view with candidates list, hide detail content
    document.getElementById('results-main-view').classList.remove('hidden');
    document.getElementById('results-detail-content').classList.add('hidden');
    this.classList.add('hidden');
});

// Close detail modal handler
document.getElementById('close-detail-modal-btn').addEventListener('click', function() {
    document.getElementById('results-detail-modal').style.display = 'none';
});

// Export results button handler (new)
document.getElementById('export-results-btn-new').addEventListener('click', function() {
    if (currentExamResults.length > 0) {
        exportResultsToCSV(currentExamResults, currentExamCodeForResults);
    } else {
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('No results to export', 'error');
        }
    }
});

// Function to export results to CSV
function exportResultsToCSV(results, examCode) {
    if (!results || results.length === 0) {
        window.PoliteCCAPI.showNotification('No results to export', 'error');
        return;
    }

    // Sort by score (highest first) to determine rank
    const sortedResults = [...results].sort((a, b) =>
        (parseFloat(b.Score || b.score || 0)) - (parseFloat(a.Score || a.score || 0))
    );

    // Prepare CSV content with Rank column
    const headers = ['Rank', 'Name', 'Mobile', 'Score', 'Submitted At'];
    const rows = sortedResults.map((result, index) => {
        const rank = index + 1;
        const rankDisplay = rank <= 3 ? ['1st', '2nd', '3rd'][rank - 1] : `${rank}th`;
        return [
            rankDisplay,
            result.Name || result.name || '',
            result.Mobile || result.mobile || '',
            parseFloat(result.Score || result.score || 0).toFixed(2),
            result['Submitted At'] || result.submittedAt || ''
        ];
    });

    // Build CSV string
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        // Escape commas and quotes in data
        const escapedRow = row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        });
        csvContent += escapedRow.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Results_${examCode}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.PoliteCCAPI.showNotification('✅ Results exported successfully!', 'success');
}

// Function to show detailed result
async function showDetailedResult(result, examCode) {
    const modal = document.getElementById('detailed-result-modal');
    const content = document.getElementById('detailed-result-content');

    // Show loading state
    content.innerHTML = '<p style="text-align: center; padding: 40px; color: #7f8c8d;"><span style="font-size: 2rem;">⏳</span><br>Loading detailed results...</p>';
    modal.style.display = 'block';

    // Get exam questions
    const exam = exams.find(e => (e['Exam Code'] || e.examCode) === examCode);
    if (!exam) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                <h3 style="color: var(--danger); margin-bottom: 15px;">Exam Not Found</h3>
                <p style="color: #7f8c8d; margin-bottom: 20px;">Unable to load exam data for: <strong>${examCode}</strong></p>
                <p style="color: #7f8c8d; font-size: 0.9rem;">The exam may have been deleted or the data is not available.</p>
            </div>
        `;
        return;
    }

    // 'Questions' is the correct Airtable field name (linked record field returns array of record IDs)
    let questionIds = exam['Questions'] || exam['Question IDs'] || exam.questionIds || exam.QuestionIDs || exam.question_ids || [];
    if (typeof questionIds === 'string') {
        questionIds = questionIds.split(',').map(id => id.trim()).filter(id => id);
    }
    if (!Array.isArray(questionIds)) {
        questionIds = [];
    }
    // Find questions by Airtable record ID (linked field) or by Question ID field (fallback)
    const examQuestions = questionIds.map(id =>
        questions.find(q => q.id === id || q.ID === id)
    ).filter(q => q);

    // Parse user answers
    let userAnswers = [];
    try {
        userAnswers = typeof result.Answers === 'string' ? JSON.parse(result.Answers) : result.Answers || [];
    } catch (e) {
        console.error('Error parsing answers:', e);
        userAnswers = result.answers || [];
    }

    // Check if we have answer data
    if (!userAnswers || userAnswers.length === 0) {
        content.innerHTML = `
            <h3 style="color: var(--secondary); margin-bottom: 20px;">Detailed Result: ${result.Name || result.name}</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div><strong>Exam:</strong> ${examCode}</div>
                <div><strong>Mobile:</strong> ${result.Mobile || result.mobile}</div>
                <div><strong>Score:</strong> <span style="color: ${(result.Score || result.score) >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: 700; font-size: 1.2rem;">${parseFloat(result.Score || result.score || 0).toFixed(2)}</span></div>
            </div>
            <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <div style="font-size: 2rem; margin-bottom: 15px;">⚠️</div>
                <h4 style="color: #856404; margin-bottom: 10px;">No Answer Data Available</h4>
                <p style="color: #856404;">This result does not contain detailed answer information.</p>
            </div>
        `;
        return;
    }

    // Build detailed view
    let html = `
        <h3 style="color: var(--secondary); margin-bottom: 20px;">Detailed Result: ${result.Name || result.name}</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <div><strong>Exam:</strong> ${examCode}</div>
            <div><strong>Mobile:</strong> ${result.Mobile || result.mobile}</div>
            <div><strong>Score:</strong> <span style="color: ${(result.Score || result.score) >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: 700; font-size: 1.2rem;">${parseFloat(result.Score || result.score || 0).toFixed(2)}</span></div>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
    `;

    // Check if userAnswers is in the new detailed format (array of objects)
    const isDetailedFormat = userAnswers.length > 0 && typeof userAnswers[0] === 'object' && userAnswers[0] !== null;

    if (isDetailedFormat) {
        // New format: detailed answer objects with userAnswer, correctAnswer, isCorrect, etc.
        userAnswers.forEach((answer, index) => {
            const isCorrect = answer.isCorrect;
            const userAnswered = answer.userAnswer !== 'Not Answered';
            const userAnswerLetter = answer.userAnswer;
            const correctAnswerLetter = answer.correctAnswer;

            html += `
                <div style="background: ${isCorrect ? '#e8f5e9' : (userAnswered ? '#ffebee' : '#f5f5f5')}; border-left: 4px solid ${isCorrect ? '#27ae60' : (userAnswered ? '#e74c3c' : '#95a5a6')}; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--secondary);">Question ${index + 1} (${answer.questionId} - ${answer.subject})</div>
                    <div style="margin-bottom: 12px; font-size: 1.05rem;">${answer.question}</div>

                    <div style="margin-bottom: 12px;">
                        <div style="margin: 5px 0; padding: 8px; background: ${userAnswerLetter === 'A' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                            <strong>A:</strong> ${answer.optionA} ${userAnswerLetter === 'A' ? '👉 <span style="color: #2196f3; font-weight: 600;">(User Answer)</span>' : ''} ${correctAnswerLetter === 'A' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                        </div>
                        <div style="margin: 5px 0; padding: 8px; background: ${userAnswerLetter === 'B' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                            <strong>B:</strong> ${answer.optionB} ${userAnswerLetter === 'B' ? '👉 <span style="color: #2196f3; font-weight: 600;">(User Answer)</span>' : ''} ${correctAnswerLetter === 'B' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                        </div>
                        <div style="margin: 5px 0; padding: 8px; background: ${userAnswerLetter === 'C' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                            <strong>C:</strong> ${answer.optionC} ${userAnswerLetter === 'C' ? '👉 <span style="color: #2196f3; font-weight: 600;">(User Answer)</span>' : ''} ${correctAnswerLetter === 'C' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                        </div>
                        <div style="margin: 5px 0; padding: 8px; background: ${userAnswerLetter === 'D' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                            <strong>D:</strong> ${answer.optionD} ${userAnswerLetter === 'D' ? '👉 <span style="color: #2196f3; font-weight: 600;">(User Answer)</span>' : ''} ${correctAnswerLetter === 'D' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                        </div>
                    </div>

                    <div style="font-weight: 600; font-size: 1.1rem;">
                        ${isCorrect ? '✅ Correct (+1)' : (userAnswered ? '❌ Incorrect (-0.25)' : '⚪ Not Answered (0)')}
                    </div>
                </div>
            `;
        });
    } else {
        // Legacy format: array of answer indices
        // Check if we have questions data
        if (examQuestions.length === 0) {
            html += `
                <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <div style="font-size: 2rem; margin-bottom: 15px;">⚠️</div>
                    <h4 style="color: #856404; margin-bottom: 10px;">Question Data Not Available</h4>
                    <p style="color: #856404;">Unable to load question details for this exam.</p>
                    <p style="color: #856404; font-size: 0.9rem; margin-top: 10px;">The candidate answered ${userAnswers.length} questions and scored ${parseFloat(result.Score || result.score || 0).toFixed(2)} points.</p>
                </div>
            `;
        } else {
            examQuestions.forEach((q, index) => {
            const userAnswerIndex = userAnswers[index];
            // Check if user actually answered (valid answer is number 0-3)
            const hasAnswered = typeof userAnswerIndex === 'number' && userAnswerIndex >= 0 && userAnswerIndex <= 3;
            const userAnswerLetter = hasAnswered ? String.fromCharCode(65 + userAnswerIndex) : 'Not Answered';
            // Support both 'Correct' and 'Correct Answer' field names, handle lowercase
            const correctValue = q.Correct || q['Correct Answer'] || '';
            const correctAnswerLetter = String(correctValue).toUpperCase().trim();
            const isCorrect = hasAnswered && userAnswerLetter === correctAnswerLetter;
            const userAnswerText = hasAnswered ? q[`Option ${userAnswerLetter}`] : 'Not Answered';
            const correctAnswerText = q[`Option ${correctAnswerLetter}`];

            html += `
                <div style="background: ${isCorrect ? '#e8f5e9' : (hasAnswered ? '#ffebee' : '#f5f5f5')}; border-left: 4px solid ${isCorrect ? '#27ae60' : (hasAnswered ? '#e74c3c' : '#95a5a6')}; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--secondary);">Question ${index + 1} (${q.ID} - ${q.Subject})</div>
                    <div style="margin-bottom: 12px; font-size: 1.05rem;">${q.Question}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                        <div>
                            <strong>Your Answer:</strong>
                            <span style="color: ${isCorrect ? '#27ae60' : (hasAnswered ? '#e74c3c' : '#7f8c8d')}; font-weight: 600;">
                                ${userAnswerLetter}${hasAnswered ? ' - ' + userAnswerText : ''}
                            </span>
                        </div>
                        <div>
                            <strong>Correct Answer:</strong>
                            <span style="color: #27ae60; font-weight: 600;">
                                ${correctAnswerLetter} - ${correctAnswerText}
                            </span>
                        </div>
                    </div>
                    <div style="font-weight: 600; font-size: 1.1rem;">
                        ${isCorrect ? '✅ Correct (+1)' : (hasAnswered ? '❌ Incorrect (-0.25)' : '⚪ Not Answered (0)')}
                    </div>
                </div>
            `;
            });
        }
    }

    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'block';

    // Close modal handler
    document.getElementById('close-detailed-modal').onclick = function() {
        modal.style.display = 'none';
    };
}

// Show upload screen
document.getElementById('upload-btn').addEventListener('click', function() {
    document.getElementById('question-bank-section').classList.add('hidden');
    document.getElementById('create-exam-section').classList.add('hidden');
    document.getElementById('view-results-section').classList.add('hidden');
    document.getElementById('upload-section').classList.remove('hidden');
    document.getElementById('ai-generator-section').classList.add('hidden');
});

// Capture photo with camera button
document.getElementById('capture-photo-btn').addEventListener('click', function() {
    const cameraInput = document.getElementById('paper-upload');
    cameraInput.click();
});

// Choose file button
document.getElementById('choose-file-btn').addEventListener('click', function() {
    const fileInput = document.getElementById('paper-upload-file');
    fileInput.click();
});

// Handle file selection from camera
document.getElementById('paper-upload').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        const fileName = e.target.files[0].name;
        document.getElementById('selected-file-info').classList.remove('hidden');
        document.getElementById('file-name').textContent = fileName;
        document.getElementById('process-upload-btn').classList.remove('hidden');
    }
});

// Handle file selection from file browser
document.getElementById('paper-upload-file').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        const fileName = e.target.files[0].name;
        // Copy the selected file to the main input
        const mainInput = document.getElementById('paper-upload');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(e.target.files[0]);
        mainInput.files = dataTransfer.files;

        document.getElementById('selected-file-info').classList.remove('hidden');
        document.getElementById('file-name').textContent = fileName;
        document.getElementById('process-upload-btn').classList.remove('hidden');
    }
});

// Process upload with Gemini Vision API
document.getElementById('process-upload-btn').addEventListener('click', async function() {
    try {
        const fileInput = document.getElementById('paper-upload');

        if (!fileInput || !fileInput.files[0]) {
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('❌ Please select a file to upload.', 'error');
            }
            return;
        }

        const file = fileInput.files[0];
        const ocrProgressBar = document.getElementById('ocr-progress-bar');
        const ocrStatus = document.getElementById('ocr-status');

        // Show step 2 (AI Processing)
        document.getElementById('upload-step-1').classList.add('hidden');
        document.getElementById('upload-step-2').classList.remove('hidden');

        // Show progress
        ocrProgressBar.style.width = '30%';
        ocrStatus.textContent = 'Reading image...';
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            ocrProgressBar.style.width = '60%';
            ocrStatus.textContent = 'Extracting questions with Gemini AI...';

            try {
                // Call backend API
                const response = await fetch(`${API_URL}/gemini/extract-questions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        imageData: {
                            base64: e.target.result,
                            mimeType: file.type
                        }
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to extract questions');
                }

                ocrProgressBar.style.width = '100%';
                ocrStatus.textContent = 'Extraction complete! Opening review...';

                // Process AI-detected hierarchical questions
                const timestamp = Date.now();
                const passageIdMap = new Map(); // Map AI parentId to our generated IDs

                // First pass: Create passage ID mapping and process questions
                let rawQuestions = data.data.questions.map((q, index) => {
                    const questionType = q.questionType || 'standalone';
                    const isPassage = questionType === 'passage';
                    const isSubQuestion = questionType === 'sub-question';

                    // Generate unique ID
                    const generatedId = isPassage ? `PASSAGE_${timestamp}_${index}` : `Q${timestamp}_${index}`;

                    // Map AI's parentId to our generated ID
                    if (isPassage && q.parentId === null) {
                        // Use the question's position or AI-generated passageId
                        const aiPassageId = `passage_${Math.floor(index / 6) + 1}`; // Approximate grouping
                        passageIdMap.set(aiPassageId, generatedId);
                    }

                    return {
                        id: generatedId,
                        subject: q.subject || 'Others',
                        question: q.question,
                        options: isPassage ? ['', '', '', ''] : [q.optionA || '', q.optionB || '', q.optionC || '', q.optionD || ''],
                        correct: isPassage ? -1 : ['A', 'B', 'C', 'D'].indexOf((q.correct || 'A').toUpperCase()),
                        questionType: isPassage ? 'Main Question' : (isSubQuestion ? 'Sub Question' : 'Standalone'),
                        parentQuestionId: q.parentId || null,
                        subQuestionNumber: q.subQuestionOrder || null,
                        mainQuestionText: null, // Will be filled in second pass
                        aiDetected: true // Flag to indicate AI detected this structure
                    };
                });

                // Second pass: Link sub-questions to their parents and fill mainQuestionText
                rawQuestions = rawQuestions.map((q, index) => {
                    if (q.questionType === 'Sub Question' && q.parentQuestionId) {
                        // Find the parent passage
                        const parentId = passageIdMap.get(q.parentQuestionId);
                        if (parentId) {
                            const parent = rawQuestions.find(p => p.id === parentId);
                            if (parent) {
                                q.parentQuestionId = parentId;
                                q.mainQuestionText = parent.question;
                            }
                        } else {
                            // Try to find parent by looking at previous questions
                            for (let i = index - 1; i >= 0; i--) {
                                if (rawQuestions[i].questionType === 'Main Question') {
                                    q.parentQuestionId = rawQuestions[i].id;
                                    q.mainQuestionText = rawQuestions[i].question;
                                    break;
                                }
                            }
                        }
                    }
                    return q;
                });

                // Check if AI detected any hierarchical structure
                const hasAIHierarchy = rawQuestions.some(q => q.questionType !== 'Standalone');

                // If AI didn't detect hierarchy, fall back to pattern detection
                if (!hasAIHierarchy) {
                    console.log('AI did not detect hierarchical structure, using pattern detection...');
                    extractedQuestions = detectAndStructureHierarchicalQuestions(rawQuestions);
                } else {
                    console.log('Using AI-detected hierarchical structure');
                    extractedQuestions = rawQuestions;
                }

                // Log summary of detected structure
                const passages = extractedQuestions.filter(q => q.questionType === 'Main Question').length;
                const subQs = extractedQuestions.filter(q => q.questionType === 'Sub Question').length;
                const standalone = extractedQuestions.filter(q => q.questionType === 'Standalone').length;
                console.log(`Detected: ${passages} passages, ${subQs} sub-questions, ${standalone} standalone questions`);

                if (extractedQuestions.length === 0) {
                    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                        window.PoliteCCAPI.showNotification('❌ No valid questions found.', 'error');
                    }
                    return;
                }

                // Open the review modal with editable forms
                openOCRReviewModal(extractedQuestions);

                if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                    let message = `✅ Extracted ${extractedQuestions.length} questions.`;
                    if (passages > 0) {
                        message += ` (${passages} passages with ${subQs} sub-questions detected)`;
                    }
                    message += ' Please review and edit.';
                    window.PoliteCCAPI.showNotification(message, 'success');
                }

            } catch (error) {
                console.error('Gemini extraction error:', error);

                // Go back to step 1
                document.getElementById('upload-step-2').classList.add('hidden');
                document.getElementById('upload-step-1').classList.remove('hidden');

                if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                    window.PoliteCCAPI.showNotification(`❌ Failed to extract questions: ${error.message}`, 'error');
                }
            }
        };

        reader.onerror = function() {
            // Go back to step 1
            document.getElementById('upload-step-2').classList.add('hidden');
            document.getElementById('upload-step-1').classList.remove('hidden');

            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('❌ Failed to read file', 'error');
            }
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error('OCR Error:', error);

        // Go back to step 1
        document.getElementById('upload-step-2').classList.add('hidden');
        document.getElementById('upload-step-1').classList.remove('hidden');

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`❌ OCR failed: ${error.message}`, 'error');
        }
    }
});

// Legacy clean text handler - no longer used with Gemini AI OCR
// Keeping for backwards compatibility if needed
if (document.getElementById('clean-text-btn')) {
    document.getElementById('clean-text-btn').addEventListener('click', function() {
        const extractedText = document.getElementById('extracted-text');
        if (!extractedText) return;

        const rawText = extractedText.value;
        extractedQuestions = [];

        // Simple text cleaning and parsing
        const questionBlocks = rawText.split(/\n\s*\n/).filter(block => block.trim() !== '');

        questionBlocks.forEach((block, index) => {
            // Extract question number and text
            const lines = block.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 6) return;

            const questionLine = lines[0].replace(/^\d+\.\s*/, '').trim();
            const options = lines.slice(1, 5).map(line => line.replace(/^[A-D]\)\s*/, '').trim());
            const answerLine = lines[5] || '';
            const correctAns = answerLine.match(/Answer:\s*([A-D])/i)?.[1] || 'A';

            const question = {
                id: `Q${Date.now()}_${index}`,
                subject: 'Others',
                question: questionLine,
                options: options,
                correct: ['A', 'B', 'C', 'D'].indexOf(correctAns)
            };

            extractedQuestions.push(question);
        });

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`✅ ${extractedQuestions.length} questions parsed`, 'success');
        }
    });
}

// Upload new button - reset to step 1
document.getElementById('upload-new-btn').addEventListener('click', function() {
    // Hide step 3, show step 1
    document.getElementById('upload-step-3').classList.add('hidden');
    document.getElementById('upload-step-1').classList.remove('hidden');

    // Clear file selection
    const fileInput = document.getElementById('paper-upload');
    const fileInputBrowser = document.getElementById('paper-upload-file');
    if (fileInput) fileInput.value = '';
    if (fileInputBrowser) fileInputBrowser.value = '';

    // Hide file info and scan button
    document.getElementById('selected-file-info').classList.add('hidden');
    document.getElementById('process-upload-btn').classList.add('hidden');

    // Clear extracted questions
    extractedQuestions = [];

    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification('📤 Ready to upload new question paper', 'info');
    }
});

// Select All extracted questions button
document.getElementById('select-all-extracted-btn').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('.extracted-question-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification(`✅ Selected all ${checkboxes.length} questions`, 'success');
    }
});

// Select None extracted questions button
document.getElementById('select-none-extracted-btn').addEventListener('click', function() {
    const checkboxes = document.querySelectorAll('.extracted-question-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification('✅ Deselected all questions', 'info');
    }
});

// Add all extracted questions to database
document.getElementById('add-extracted-btn').addEventListener('click', async function() {
    try {
        if (extractedQuestions.length === 0) {
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('❌ No questions to add.', 'error');
            }
            return;
        }

        // Add questions to database with parent-child relationships
        let successCount = 0;
        const savedQuestionIds = {}; // Map temp IDs to actual Airtable record IDs

        for (const q of extractedQuestions) {
            const questionData = {
                subject: q.subject,
                question: q.question,
                optionA: q.options[0],
                optionB: q.options[1],
                optionC: q.options[2],
                optionD: q.options[3],
                correct: ['A', 'B', 'C', 'D'][q.correct],
                questionType: q.questionType || 'Standalone',
                subQuestionNumber: q.subQuestionNumber || null,
                mainQuestionText: q.mainQuestionText || null
            };

            const success = await window.PoliteCCAPI.addQuestionToDatabase(questionData);

            if (success) successCount++;
        }

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`✅ ${successCount} questions added to bank!`, 'success');
        }

        // Reset to step 1 and clear extracted questions
        document.getElementById('upload-step-3').classList.add('hidden');
        document.getElementById('upload-step-1').classList.remove('hidden');

        // Clear file selection
        const fileInput = document.getElementById('paper-upload');
        const fileInputBrowser = document.getElementById('paper-upload-file');
        if (fileInput) fileInput.value = '';
        if (fileInputBrowser) fileInputBrowser.value = '';
        document.getElementById('selected-file-info').classList.add('hidden');
        document.getElementById('process-upload-btn').classList.add('hidden');

        extractedQuestions = [];

        // Refresh question bank
        document.getElementById('question-bank-btn').click();
    } catch (error) {
        console.error('❌ Error adding extracted questions:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ Failed to add questions: ' + error.message, 'error');
        }
    }
});

// Add selected extracted questions to database
document.getElementById('add-selected-btn').addEventListener('click', async function() {
    try {
        if (extractedQuestions.length === 0) {
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('❌ No questions to add.', 'error');
            }
            return;
        }

        // Get selected checkboxes
        const selectedCheckboxes = document.querySelectorAll('.extracted-question-checkbox:checked');

        if (selectedCheckboxes.length === 0) {
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('❌ No questions selected. Please select at least one question.', 'error');
            }
            return;
        }

        // Map to track old IDs to new database IDs for parent-child linking
        const idMap = new Map();
        let successCount = 0;
        let passageCount = 0;
        let subQuestionCount = 0;

        // First pass: Add all passages/main questions first to get their database IDs
        for (const checkbox of selectedCheckboxes) {
            const index = parseInt(checkbox.value);
            const q = extractedQuestions[index];

            if (q.questionType === 'Main Question') {
                const questionData = {
                    subject: q.subject,
                    question: q.question,
                    optionA: '',
                    optionB: '',
                    optionC: '',
                    optionD: '',
                    correct: '',
                    isMainQuestion: true
                };

                const success = await window.PoliteCCAPI.addQuestionToDatabase(questionData);
                if (success) {
                    successCount++;
                    passageCount++;
                    // Store mapping of old ID to indicate this passage was added
                    idMap.set(q.id, true);
                }
            }
        }

        // Second pass: Add sub-questions and standalone questions
        for (const checkbox of selectedCheckboxes) {
            const index = parseInt(checkbox.value);
            const q = extractedQuestions[index];

            if (q.questionType !== 'Main Question') {
                const isSubQuestion = q.questionType === 'Sub Question';

                const questionData = {
                    subject: q.subject,
                    question: q.question,
                    optionA: q.options ? q.options[0] : '',
                    optionB: q.options ? q.options[1] : '',
                    optionC: q.options ? q.options[2] : '',
                    optionD: q.options ? q.options[3] : '',
                    options: q.options || ['', '', '', ''],  // Also pass array for backup
                    correct: q.correct >= 0 ? ['A', 'B', 'C', 'D'][q.correct] : ''
                };
                console.log('📦 Sub-question data:', { questionType: q.questionType, options: q.options, questionData });

                // Add hierarchical fields for sub-questions
                if (isSubQuestion) {
                    questionData.isSubQuestion = true;
                    questionData.subQuestionOrder = q.subQuestionNumber || 1;
                    // Set parent question ID if available
                    if (q.parentQuestionId) {
                        questionData.parentQuestionId = q.parentQuestionId;
                    }
                }

                const success = await window.PoliteCCAPI.addQuestionToDatabase(questionData);
                if (success) {
                    successCount++;
                    if (isSubQuestion) subQuestionCount++;
                }
            }
        }

        // Generate appropriate success message
        let message = `✅ ${successCount} questions added to bank!`;
        if (passageCount > 0) {
            message = `✅ Added ${successCount} questions (${passageCount} passages, ${subQuestionCount} sub-questions)`;
        }

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(message, 'success');
        }

        // Reset to step 1 and clear extracted questions
        document.getElementById('upload-step-3').classList.add('hidden');
        document.getElementById('upload-step-1').classList.remove('hidden');

        // Clear file selection
        const fileInput = document.getElementById('paper-upload');
        const fileInputBrowser = document.getElementById('paper-upload-file');
        if (fileInput) fileInput.value = '';
        if (fileInputBrowser) fileInputBrowser.value = '';
        document.getElementById('selected-file-info').classList.add('hidden');
        document.getElementById('process-upload-btn').classList.add('hidden');

        extractedQuestions = [];

        // Refresh question bank
        document.getElementById('question-bank-btn').click();
    } catch (error) {
        console.error('❌ Error adding selected questions:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ Failed to add questions: ' + error.message, 'error');
        }
    }
});

// Show AI generator
document.getElementById('ai-btn').addEventListener('click', function() {
    document.getElementById('question-bank-section').classList.add('hidden');
    document.getElementById('create-exam-section').classList.add('hidden');
    document.getElementById('view-results-section').classList.add('hidden');
    document.getElementById('upload-section').classList.add('hidden');
    document.getElementById('ai-generator-section').classList.remove('hidden');
});

// Track previously generated questions to avoid repetition
let previouslyGeneratedQuestions = [];
const MAX_PREVIOUS_QUESTIONS = 10;
let aiGeneratedParentChild = null; // Store parent-child question data

// Toggle sub-questions count visibility based on question format
document.getElementById('ai-question-format').addEventListener('change', function() {
    const subQCountGroup = document.getElementById('sub-questions-count-group');
    if (this.value === 'parent-child') {
        subQCountGroup.style.display = 'block';
    } else {
        subQCountGroup.style.display = 'none';
    }
});

// Generate AI question with real Gemini API
document.getElementById('generate-ai-btn').addEventListener('click', async function() {
    const generateBtn = document.getElementById('generate-ai-btn');
    try {
        const subject = document.getElementById('ai-subject').value;
        const difficulty = document.getElementById('ai-difficulty').value;
        const customPrompt = document.getElementById('ai-custom-prompt').value.trim();
        const questionFormat = document.getElementById('ai-question-format').value;
        const numSubQuestions = parseInt(document.getElementById('ai-sub-questions-count').value) || 3;

        const isParentChild = questionFormat === 'parent-child';

        // Show processing notification
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            const msg = isParentChild ?
                '🤖 AI is generating passage-based questions...' :
                '🤖 AI is generating a unique question...';
            window.PoliteCCAPI.showNotification(msg, 'info');
        }

        // Disable button during generation
        generateBtn.disabled = true;
        generateBtn.textContent = isParentChild ? '⏳ Generating Passage...' : '⏳ Generating...';

        // Hide both result containers
        document.getElementById('ai-result-container').classList.add('hidden');
        document.getElementById('ai-parent-child-result').classList.add('hidden');

        // Call backend API
        console.log('Sending AI generation request:', {
            subject,
            difficulty,
            customPrompt,
            questionFormat,
            numSubQuestions
        });

        const response = await fetch(`${API_URL}/gemini/generate-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: subject,
                difficulty: difficulty,
                customPrompt: customPrompt,
                previousQuestions: previouslyGeneratedQuestions,
                questionFormat: questionFormat,
                numSubQuestions: numSubQuestions
            })
        });

        console.log('API Response status:', response.status);

        const data = await response.json();
        console.log('API Response data:', data);

        if (!data.success) {
            console.error('API returned error:', data.error);
            throw new Error(data.error || 'Failed to generate question');
        }

        const qData = data.data;
        console.log('Question data received:', qData);

        // Validate that qData exists and has required properties
        if (!qData) {
            console.error('Invalid API response - missing data:', data);
            throw new Error('Invalid response from AI service - no question data received');
        }

        // Log the properties we're checking
        console.log('Question properties:', {
            hasQuestion: !!qData.question,
            hasOptions: !!(qData.optionA && qData.optionB && qData.optionC && qData.optionD),
            hasCorrect: !!qData.correct,
            hasSubject: !!qData.subject,
            hasDifficulty: !!qData.difficulty
        });

        if (qData.isParentChild) {
            // Handle Parent-Child format
            displayParentChildQuestion(qData);
        } else {
            // Handle Standalone format
            displayStandaloneQuestion(qData);
        }

        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            const msg = qData.isParentChild ?
                '✅ Passage-based questions generated successfully!' :
                '✅ AI question generated successfully!';
            window.PoliteCCAPI.showNotification(msg, 'success');
        }

    } catch (error) {
        console.error('AI generation error:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`❌ Failed to generate question: ${error.message}`, 'error');
        }
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ Generate Question with AI';
    }
});

// Display standalone question with KaTeX rendering
function displayStandaloneQuestion(qData) {
    // Validate and set default values for required fields
    const question = qData?.question || 'Question not available';
    const optionA = qData?.optionA || 'Option A not available';
    const optionB = qData?.optionB || 'Option B not available';
    const optionC = qData?.optionC || 'Option C not available';
    const optionD = qData?.optionD || 'Option D not available';
    const correct = qData?.correct || 'A';
    const explanation = qData?.explanation || 'Explanation not available';
    const subject = qData?.subject || 'General';
    const difficulty = qData?.difficulty || 'medium';

    // Track this question
    if (question && question !== 'Question not available') {
        previouslyGeneratedQuestions.unshift(question.substring(0, 100));
        if (previouslyGeneratedQuestions.length > MAX_PREVIOUS_QUESTIONS) {
            previouslyGeneratedQuestions = previouslyGeneratedQuestions.slice(0, MAX_PREVIOUS_QUESTIONS);
        }
    }

    // Use renderRichContent for KaTeX/LaTeX rendering
    renderRichContent(question, document.getElementById('ai-question-text'));
    renderRichContent(optionA, document.getElementById('ai-option-a'));
    renderRichContent(optionB, document.getElementById('ai-option-b'));
    renderRichContent(optionC, document.getElementById('ai-option-c'));
    renderRichContent(optionD, document.getElementById('ai-option-d'));
    document.getElementById('ai-correct-answer').textContent = correct;
    renderRichContent(explanation, document.getElementById('ai-explanation'));
    document.getElementById('ai-display-subject').textContent = subject;
    document.getElementById('ai-display-difficulty').textContent = difficulty.toUpperCase();

    aiGeneratedQuestion = {
        subject: subject,
        question: question,
        options: [optionA, optionB, optionC, optionD],
        correct: ['A', 'B', 'C', 'D'].indexOf(correct.toUpperCase()),
        difficulty: difficulty
    };

    document.getElementById('ai-result-container').classList.remove('hidden');
    document.getElementById('ai-parent-child-result').classList.add('hidden');
}

// Display parent-child questions with KaTeX rendering
function displayParentChildQuestion(qData) {
    // Validate and set default values
    const subject = qData?.subject || 'General';
    const difficulty = qData?.difficulty || 'medium';
    const mainQuestionText = qData?.mainQuestionText || 'Passage not available';
    const subQuestions = qData?.subQuestions || [];

    // Store for later saving
    aiGeneratedParentChild = {
        subject: subject,
        difficulty: difficulty,
        mainQuestionText: mainQuestionText,
        subQuestions: subQuestions
    };

    // Display subject and difficulty
    document.getElementById('ai-pc-subject').textContent = subject;
    document.getElementById('ai-pc-difficulty').textContent = difficulty.toUpperCase();

    // Display passage with KaTeX rendering
    renderRichContent(mainQuestionText, document.getElementById('ai-pc-passage'));

    // Display sub-questions with KaTeX rendering
    const container = document.getElementById('ai-pc-subquestions-container');
    container.innerHTML = '';

    if (subQuestions.length > 0) {
        subQuestions.forEach((sq, idx) => {
            // Validate each sub-question
            const question = sq?.question || 'Question not available';
            const optionA = sq?.optionA || 'Option A';
            const optionB = sq?.optionB || 'Option B';
            const optionC = sq?.optionC || 'Option C';
            const optionD = sq?.optionD || 'Option D';
            const correct = sq?.correct || 'A';
            const explanation = sq?.explanation || 'N/A';

            const sqHtml = `
                <div style="background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #dee2e6;">
                    <h5 style="margin: 0 0 10px 0; color: #495057;">Sub-Question ${idx + 1}:</h5>
                    <p style="font-weight: 500; margin-bottom: 10px;">${getRichContentHtml(question)}</p>
                    <div style="margin-left: 20px; margin-bottom: 10px;">
                        <div>A) ${getRichContentHtml(optionA)}</div>
                        <div>B) ${getRichContentHtml(optionB)}</div>
                        <div>C) ${getRichContentHtml(optionC)}</div>
                        <div>D) ${getRichContentHtml(optionD)}</div>
                    </div>
                    <div style="background: #e8f5e9; padding: 8px 12px; border-radius: 4px; font-size: 0.9rem;">
                        <strong>Answer:</strong> ${correct} | <strong>Explanation:</strong> ${getRichContentHtml(explanation)}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', sqHtml);
        });
    } else {
        container.innerHTML = '<p style="color: #dc3545;">No sub-questions were generated. Please try again.</p>';
    }

    document.getElementById('ai-parent-child-result').classList.remove('hidden');
    document.getElementById('ai-result-container').classList.add('hidden');
}

// Accept standalone AI question and add to database
document.getElementById('accept-ai-btn').addEventListener('click', async function() {
    const acceptBtn = document.getElementById('accept-ai-btn');
    try {
        if (!aiGeneratedQuestion) return;

        acceptBtn.disabled = true;
        acceptBtn.textContent = '⏳ Saving...';

        const success = await window.PoliteCCAPI.addQuestionToDatabase({
            subject: aiGeneratedQuestion.subject,
            question: aiGeneratedQuestion.question,
            optionA: aiGeneratedQuestion.options[0],
            optionB: aiGeneratedQuestion.options[1],
            optionC: aiGeneratedQuestion.options[2],
            optionD: aiGeneratedQuestion.options[3],
            correct: String.fromCharCode(65 + aiGeneratedQuestion.correct)
        });

        if (success) {
            aiGeneratedQuestion = null;
            document.getElementById('ai-result-container').classList.add('hidden');
            document.getElementById('ai-custom-prompt').value = '';

            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('✅ AI question added to your bank!', 'success');
            }
        }

    } catch (error) {
        console.error('Error accepting AI question:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`❌ Failed to save question: ${error.message}`, 'error');
        }
    } finally {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept & Add to Bank';
    }
});

// Accept parent-child questions and add to database
document.getElementById('accept-ai-pc-btn').addEventListener('click', async function() {
    const acceptBtn = document.getElementById('accept-ai-pc-btn');
    try {
        if (!aiGeneratedParentChild) return;

        acceptBtn.disabled = true;
        acceptBtn.textContent = '⏳ Saving All Questions...';

        // First, add the parent question (passage)
        const parentResult = await window.PoliteCCAPI.addQuestionToDatabase({
            subject: aiGeneratedParentChild.subject,
            question: aiGeneratedParentChild.mainQuestionText,
            'Question Type': 'Parent-child',
            'Main Question Text': aiGeneratedParentChild.mainQuestionText,
            isMainQuestion: true
        });

        if (!parentResult || !parentResult.id) {
            throw new Error('Failed to create parent question');
        }

        const parentRecordId = parentResult.id;

        // Now add all sub-questions linked to the parent
        let successCount = 0;
        for (let i = 0; i < aiGeneratedParentChild.subQuestions.length; i++) {
            const sq = aiGeneratedParentChild.subQuestions[i];
            const childResult = await window.PoliteCCAPI.addQuestionToDatabase({
                subject: aiGeneratedParentChild.subject,
                question: sq.question,
                optionA: sq.optionA,
                optionB: sq.optionB,
                optionC: sq.optionC,
                optionD: sq.optionD,
                correct: sq.correct,
                'Question Type': 'Parent-child',
                'Parent Question': [parentRecordId],
                'Sub Question Number': i + 1
            });

            if (childResult) {
                successCount++;
            }
        }

        if (successCount > 0) {
            aiGeneratedParentChild = null;
            document.getElementById('ai-parent-child-result').classList.add('hidden');
            document.getElementById('ai-custom-prompt').value = '';

            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification(`✅ Parent + ${successCount} sub-questions added to bank!`, 'success');
            }
        }

    } catch (error) {
        console.error('Error accepting parent-child questions:', error);
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification(`❌ Failed to save: ${error.message}`, 'error');
        }
    } finally {
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept & Add All to Bank';
    }
});

// Regenerate AI question (standalone)
document.getElementById('regenerate-ai-btn').addEventListener('click', function() {
    document.getElementById('generate-ai-btn').click();
});

// Regenerate AI question (parent-child)
document.getElementById('regenerate-ai-pc-btn').addEventListener('click', function() {
    document.getElementById('generate-ai-btn').click();
});


// Start exam
document.getElementById('start-exam-btn').addEventListener('click', async function() {
    try {
        const examCode = document.getElementById('exam-code-input').value.trim();
        const name = document.getElementById('candidate-name').value.trim();
        const mobile = document.getElementById('candidate-mobile').value.trim();

        if (!examCode || !name || !mobile) {
            const loginError = document.getElementById('login-error');
            if (loginError) {
                loginError.textContent = '❌ Please select an exam, enter your name, and mobile number!';
                setTimeout(() => {
                    loginError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Validate mobile number (should be 10 digits)
        if (!/^\d{10}$/.test(mobile)) {
            const loginError = document.getElementById('login-error');
            if (loginError) {
                loginError.textContent = '❌ Please enter a valid 10-digit mobile number!';
                setTimeout(() => {
                    loginError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Always load exams and questions from API (ignore sample data)
        // This fixes the "Questions not found" bug where sample data blocked API loading
        if (window.PoliteCCAPI) {
            const loginError = document.getElementById('login-error');
            if (loginError) loginError.textContent = '🔄 Loading exam data...';

            // Always load fresh data from API
            const apiExams = await window.PoliteCCAPI.loadExams();
            const apiQuestions = await window.PoliteCCAPI.loadQuestions();

            // Use API data if available, otherwise fall back to existing data
            if (apiExams && apiExams.length > 0) {
                exams = apiExams;
            }
            if (apiQuestions && apiQuestions.length > 0) {
                questions = apiQuestions;
            }

            if (loginError) loginError.textContent = '';
        }

        // Find exam (case-insensitive comparison)
        const exam = exams.find(e => (e['Exam Code'] || '').toUpperCase() === examCode.toUpperCase());

        if (!exam) {
            const loginError = document.getElementById('login-error');
            if (loginError) {
                loginError.textContent = '❌ Invalid exam code!';
                setTimeout(() => {
                    loginError.textContent = '';
                }, 3000);
            }
            return;
        }

        // Check if exam has expired
        if (exam['Expiry (IST)']) {
            const expiryDate = new Date(exam['Expiry (IST)']);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expiryDate.setHours(0, 0, 0, 0);

            if (expiryDate.getTime() < today.getTime()) {
                const loginError = document.getElementById('login-error');
                if (loginError) {
                    loginError.textContent = '❌ This exam has expired! Only admin can view results.';
                    setTimeout(() => {
                        loginError.textContent = '';
                    }, 5000);
                }
                return;
            }
        }

        // Get questions for this exam
        // 'Questions' is the correct Airtable field name (linked record field returns array of record IDs)
        let questionIds = exam['Questions'] || exam['Question IDs'] || exam.questionIds || exam.QuestionIDs || exam.question_ids || [];

        // Ensure it's an array
        if (typeof questionIds === 'string') {
            questionIds = questionIds.split(',').map(id => id.trim()).filter(id => id);
        }
        if (!Array.isArray(questionIds)) {
            questionIds = [];
        }

        // Find questions by Airtable record ID (new format) or by Question ID field (old format)
        let examQuestions = questionIds
            .map(id => questions.find(q => q.id === id || q.ID === id))
            .filter(q => q);

        // Auto-fetch child questions for any parent questions (for backwards compatibility with old exams)
        const additionalChildren = [];
        examQuestions.forEach(q => {
            const questionType = q['Question Type'];
            const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;

            // If this is a parent question (Parent-child type without parent link), find its children
            if (questionType === 'Parent-child' && !hasParentLink) {
                const parentRecordId = q.id;

                // Find all child questions that reference this parent
                questions.forEach(childQ => {
                    const childParentLink = childQ['Parent Question'];
                    if (childParentLink && childParentLink.length > 0 && childParentLink[0] === parentRecordId) {
                        // Check if this child is not already in examQuestions
                        const alreadyIncluded = examQuestions.some(eq => eq.id === childQ.id);
                        const alreadyAdded = additionalChildren.some(ac => ac.id === childQ.id);
                        if (!alreadyIncluded && !alreadyAdded) {
                            additionalChildren.push(childQ);
                        }
                    }
                });
            }
        });

        // Add any missing child questions
        if (additionalChildren.length > 0) {
            console.log(`📋 Auto-added ${additionalChildren.length} child questions for parent-child groups`);
            examQuestions = [...examQuestions, ...additionalChildren];
        }


        if (examQuestions.length === 0) {
            const loginError = document.getElementById('login-error');
            if (loginError) {
                if (questionIds.length === 0) {
                    loginError.textContent = '❌ This exam has no questions assigned to it!';
                } else {
                    loginError.textContent = `❌ Could not find questions (${questionIds.length} IDs in exam but none matched)`;
                }
                setTimeout(() => {
                    loginError.textContent = '';
                }, 5000);
            }
            return;
        }

        // Prepare exam data
        currentExam = {
            code: exam['Exam Code'],  // Use actual exam code from database
            examId: exam.id,  // Store the Airtable record ID for linking
            title: exam.Title,
            duration: parseInt(exam['Duration (mins)']) || 60,
            questions: examQuestions,
            startTime: new Date()
        };

        // Initialize answers array
        userAnswers = new Array(examQuestions.length).fill(null);
        currentQuestionIndex = 0;

        // Skip to first non-child question (children are shown with their parent)
        while (currentQuestionIndex < examQuestions.length) {
            const q = examQuestions[currentQuestionIndex];
            const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
            const isChild = hasParentLink || q.isSubQuestion || q['Is Sub Question'];
            if (!isChild) break;
            currentQuestionIndex++;
        }
        // Reset to 0 if all questions are children (shouldn't happen)
        if (currentQuestionIndex >= examQuestions.length) {
            currentQuestionIndex = 0;
        }

        // Start timer using the centralized timer function
        timeRemaining = currentExam.duration * 60;
        startTime = new Date();
        startExamTimer();

        // Update exam title display in the new UI
        const examTitleDisplay = document.getElementById('exam-title-display');
        if (examTitleDisplay) {
            examTitleDisplay.textContent = currentExam.title || 'Exam';
        }

        // Show exam screen
        document.getElementById('candidate-login-screen').classList.remove('active');
        document.getElementById('exam-screen').classList.add('active');
        updateHeaderNav('exam-screen');

        loadQuestion();
        updateQuestionNavigator();

        // Save initial exam state for resume functionality
        saveExamState();

        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = '✅ Exam started successfully!';
        document.getElementById('notification-container').appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    } catch (error) {
        console.error('❌ Error starting exam:', error);
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.textContent = '❌ Failed to start exam: ' + error.message;
            setTimeout(() => {
                loginError.textContent = '';
            }, 5000);
        }
        if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
            window.PoliteCCAPI.showNotification('❌ Failed to start exam: ' + error.message, 'error');
        }
    }
});

// Option selection - handle clicks on option div, radio button, or child elements
// ONLY for standalone questions (NOT for child options in parent-child groups)
document.addEventListener('click', function(e) {
    // Find the parent option element
    const optionElement = e.target.closest('.option');
    if (optionElement && optionElement.closest('#exam-screen')) {
        // Skip if this is a child option (handled separately in loadQuestion)
        if (optionElement.classList.contains('child-option')) {
            return;
        }
        const optionIndex = parseInt(optionElement.getAttribute('data-index'));
        selectOption(optionIndex);
    }
});

function selectOption(index) {
    const options = document.querySelectorAll('#exam-screen .option');
    const radios = document.querySelectorAll('#exam-screen .option-radio');

    // Check if clicking the same option again (toggle off)
    if (userAnswers[currentQuestionIndex] === index) {
        // Deselect - user wants to not answer this question
        userAnswers[currentQuestionIndex] = undefined;
        options[index].classList.remove('selected');
        radios[index].checked = false;
    } else {
        // Select new option
        userAnswers[currentQuestionIndex] = index;
        options.forEach((option, i) => {
            if (i === index) {
                option.classList.add('selected');
                radios[i].checked = true;
            } else {
                option.classList.remove('selected');
                radios[i].checked = false;
            }
        });
    }
    // Save exam state after answer selection for resume functionality
    saveExamState();
}

// Helper function to check if a question is a child
function isChildQuestionCheck(q) {
    const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
    return hasParentLink || q.isSubQuestion || q['Is Sub Question'];
}

// Previous question - skip child questions (they're shown with parent)
document.getElementById('prev-btn').addEventListener('click', function() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        // Skip child questions - find previous non-child
        while (currentQuestionIndex > 0 && isChildQuestionCheck(currentExam.questions[currentQuestionIndex])) {
            currentQuestionIndex--;
        }
        loadQuestion();
        saveExamState();
    }
});

// Next question - skip child questions (they're shown with parent)
document.getElementById('next-btn').addEventListener('click', function() {
    if (currentQuestionIndex < currentExam.questions.length - 1) {
        currentQuestionIndex++;
        // Skip child questions - find next non-child
        while (currentQuestionIndex < currentExam.questions.length - 1 && isChildQuestionCheck(currentExam.questions[currentQuestionIndex])) {
            currentQuestionIndex++;
        }
        // If we landed on a child at the end, we're done
        if (isChildQuestionCheck(currentExam.questions[currentQuestionIndex])) {
            // This shouldn't happen normally, but handle edge case
            document.getElementById('next-btn').style.display = 'none';
            document.getElementById('submit-btn').style.display = 'block';
        }
        loadQuestion();
        saveExamState();
    }
});

// Submit exam - handle both old and new button IDs
document.getElementById('submit-btn')?.addEventListener('click', function() {
    submitExam();
});

// New UI submit button
const submitExamBtn = document.getElementById('submit-exam-btn');
if (submitExamBtn) {
    submitExamBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to submit the exam? You cannot change your answers after submission.')) {
            submitExam();
        }
    });
}

// Floating submit button handler
const floatingSubmitBtn = document.getElementById('floating-submit-btn');
if (floatingSubmitBtn) {
    floatingSubmitBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to submit the exam? You cannot change your answers after submission.')) {
            submitExam();
        }
    });
}

// Function to show candidate's own detailed results (used by results modal)
function showCandidateOwnResults() {
    const modal = document.getElementById('results-detail-modal');
    const content = document.getElementById('results-detail-content');

    const data = candidateDetailedAnswers;

    // Build detailed view
    let html = `
        <h3 style="color: var(--secondary); margin-bottom: 20px;">Your Detailed Results</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap; gap: 15px;">
            <div><strong>Name:</strong> ${data.candidateName}</div>
            <div><strong>Exam:</strong> ${data.examCode}</div>
            <div><strong>Score:</strong> <span style="color: ${data.score >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: 700; font-size: 1.2rem;">${data.score}</span></div>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
    `;

    data.answers.forEach((answer, index) => {
        const isCorrect = answer.isCorrect;
        const userAnswered = answer.userAnswer !== 'Not Answered';

        html += `
            <div style="background: ${isCorrect ? '#e8f5e9' : (userAnswered ? '#ffebee' : '#f5f5f5')}; border-left: 4px solid ${isCorrect ? '#27ae60' : (userAnswered ? '#e74c3c' : '#95a5a6')}; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
                <div style="font-weight: 600; margin-bottom: 8px; color: var(--secondary);">Question ${index + 1} (${answer.questionId} - ${answer.subject})</div>
                <div style="margin-bottom: 12px; font-size: 1.05rem;">${answer.question}</div>

                <div style="margin-bottom: 12px;">
                    <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'A' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                        <strong>A:</strong> ${answer.optionA} ${answer.userAnswer === 'A' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'A' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                    </div>
                    <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'B' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                        <strong>B:</strong> ${answer.optionB} ${answer.userAnswer === 'B' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'B' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                    </div>
                    <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'C' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                        <strong>C:</strong> ${answer.optionC} ${answer.userAnswer === 'C' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'C' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                    </div>
                    <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'D' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                        <strong>D:</strong> ${answer.optionD} ${answer.userAnswer === 'D' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'D' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                    </div>
                </div>

                <div style="font-weight: 600; font-size: 1.1rem;">
                    ${isCorrect ? '✅ Correct (+1 point)' : (userAnswered ? '❌ Incorrect (-0.25 points)' : '⚪ Not Answered (0 points)')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'block';

    // Close modal handler is already set up for results-detail-modal
}

// Function to show detailed results for a candidate's exam history item
function showCandidateExamDetails(exam) {
    const modal = document.getElementById('results-detail-modal');
    const content = document.getElementById('results-detail-content');

    if (!modal || !content) return;

    const date = formatDateForDisplay(exam.timestamp || exam.date);
    const score = exam.score || 0;
    const scoreColor = score >= 0 ? '#27ae60' : '#e74c3c';

    // Build detailed view
    let html = `
        <h3 style="color: var(--secondary); margin-bottom: 20px;">Exam Details</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap; gap: 15px;">
            <div><strong>Exam Code:</strong> ${exam.examCode || 'N/A'}</div>
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Score:</strong> <span style="color: ${scoreColor}; font-weight: 700; font-size: 1.2rem;">${score}</span></div>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
    `;

    // Parse answers to build question details
    try {
        const answers = typeof exam.answers === 'string' ? JSON.parse(exam.answers) : exam.answers || [];

        if (answers && answers.length > 0) {
            // Check if it's detailed format (array of objects with question data)
            if (typeof answers[0] === 'object' && answers[0].question) {
                answers.forEach((answer, index) => {
                    const isCorrect = answer.isCorrect;
                    const userAnswered = answer.userAnswer !== 'Not Answered';

                    html += `
                        <div style="background: ${isCorrect ? '#e8f5e9' : (userAnswered ? '#ffebee' : '#f5f5f5')}; border-left: 4px solid ${isCorrect ? '#27ae60' : (userAnswered ? '#e74c3c' : '#95a5a6')}; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
                            <div style="font-weight: 600; margin-bottom: 8px; color: var(--secondary);">Question ${index + 1}</div>
                            <div style="margin-bottom: 12px; font-size: 1.05rem;">${answer.question}</div>

                            <div style="margin-bottom: 12px;">
                                <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'A' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                                    <strong>A:</strong> ${answer.optionA || 'N/A'} ${answer.userAnswer === 'A' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'A' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                                </div>
                                <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'B' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                                    <strong>B:</strong> ${answer.optionB || 'N/A'} ${answer.userAnswer === 'B' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'B' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                                </div>
                                <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'C' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                                    <strong>C:</strong> ${answer.optionC || 'N/A'} ${answer.userAnswer === 'C' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'C' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                                </div>
                                <div style="margin: 5px 0; padding: 8px; background: ${answer.userAnswer === 'D' ? (isCorrect ? '#c8e6c9' : '#ffcdd2') : '#f9f9f9'}; border-radius: 4px;">
                                    <strong>D:</strong> ${answer.optionD || 'N/A'} ${answer.userAnswer === 'D' ? '👉 <span style="color: #2196f3; font-weight: 600;">(Your Answer)</span>' : ''} ${answer.correctAnswer === 'D' ? '✅ <span style="color: #27ae60; font-weight: 600;">(Correct)</span>' : ''}
                                </div>
                            </div>

                            <div style="font-weight: 600; font-size: 1.1rem;">
                                ${isCorrect ? '✅ Correct (+1 point)' : (userAnswered ? '❌ Incorrect (-0.25 points)' : '⚪ Not Answered (0 points)')}
                            </div>
                        </div>
                    `;
                });
            } else {
                // Legacy format - just show basic info
                html += `
                    <div style="text-align: center; padding: 40px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <div style="font-size: 2rem; margin-bottom: 15px;">📊</div>
                        <h4 style="color: #1565c0; margin-bottom: 10px;">Exam Summary</h4>
                        <p style="color: #1565c0;">You answered ${answers.length} questions in this exam.</p>
                        <p style="color: #1565c0; font-size: 1.2rem; margin-top: 15px;">Final Score: <strong style="font-size: 1.5rem;">${score}</strong></p>
                    </div>
                `;
            }
        } else {
            html += `
                <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <div style="font-size: 2rem; margin-bottom: 15px;">⚠️</div>
                    <h4 style="color: #856404; margin-bottom: 10px;">No Detailed Data Available</h4>
                    <p style="color: #856404;">Question-level details are not available for this exam.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error('Error parsing exam answers:', e);
        html += `
            <div style="text-align: center; padding: 40px; background: #ffebee; border-radius: 8px; border-left: 4px solid #e74c3c;">
                <div style="font-size: 2rem; margin-bottom: 15px;">❌</div>
                <h4 style="color: #c62828; margin-bottom: 10px;">Error Loading Details</h4>
                <p style="color: #c62828;">Unable to load question details for this exam.</p>
            </div>
        `;
    }

    html += '</div>';
    content.innerHTML = html;

    // Process LaTeX/math content in results
    processRichContentInContainer(content);

    modal.style.display = 'flex';
}

// Result screen navigation handlers
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener('click', function() {
        const session = getSession();
        document.getElementById('result-screen').classList.remove('active');
        if (session && session.userType === 'candidate') {
            showCandidateDashboard(session.userData);
        } else {
            document.getElementById('hero-landing').classList.add('active');
            updateHeaderNav('hero-landing');
        }
    });
}

const takeAnotherExamBtn = document.getElementById('take-another-exam-btn');
if (takeAnotherExamBtn) {
    takeAnotherExamBtn.addEventListener('click', function() {
        const session = getSession();
        document.getElementById('result-screen').classList.remove('active');
        if (session && session.userType === 'candidate') {
            document.getElementById('candidate-login-screen').classList.add('active');
            updateHeaderNav('candidate-login-screen');
        } else {
            document.getElementById('hero-landing').classList.add('active');
            updateHeaderNav('hero-landing');
        }
    });
}

// Log out and close from result screen
document.getElementById('result-logout-btn').addEventListener('click', function() {
    // Clear any running exam timer
    if (typeof examTimer !== 'undefined' && examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }

    // Reset candidate detailed answers
    candidateDetailedAnswers = null;

    // Clear session
    clearSession();

    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Show landing page
    document.getElementById('hero-landing').classList.add('active');
    updateHeaderNav('hero-landing');

    // Show notification
    if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
        window.PoliteCCAPI.showNotification('👋 Session ended successfully', 'success');
    }
});

// Timer functions
function startTimer() {
    updateTimerDisplay();
    
    examTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(examTimer);
            autoSubmitExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update both old and new timer elements for compatibility
    const timerDisplayOld = document.getElementById('timer-display');
    const timerDisplayNew = document.getElementById('time-remaining');

    if (timerDisplayOld) timerDisplayOld.textContent = `⏱️ Time Remaining: ${timeStr}`;
    if (timerDisplayNew) timerDisplayNew.textContent = timeStr;

    // Add warning class when time is low
    const timerBadge = document.getElementById('timer');
    if (timerBadge) {
        if (timeRemaining <= 60) {
            timerBadge.classList.remove('badge-primary', 'badge-warning');
            timerBadge.classList.add('badge-error');
        } else if (timeRemaining <= 300) {
            timerBadge.classList.remove('badge-primary', 'badge-error');
            timerBadge.classList.add('badge-warning');
        }
    }
}

function autoSubmitExam() {
    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.innerHTML = '⏰ Time is up! Exam submitted automatically.';
    document.getElementById('notification-container').appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
    
    submitExam(true);
}

async function submitExam(isAutoSubmit = false) {
    clearInterval(examTimer);

    // Clear saved exam state since we're submitting
    clearExamState();

    // Calculate score and prepare detailed answers
    let score = 0;
    const detailedAnswers = [];

    currentExam.questions.forEach((question, index) => {
        const userAnswer = userAnswers[index];

        // Check if this is a main passage question (no options = no marks)
        const isMainPassage = !question['Option A'] && !question['Option B'];
        const isSubQuestion = question['Is Sub Question'] === true || question['Is Sub Question'] === 'true';
        const parentQuestionId = question['Parent Question ID'];

        // Check if user actually answered this question (valid answer is 0, 1, 2, or 3)
        const hasAnswered = typeof userAnswer === 'number' && userAnswer >= 0 && userAnswer <= 3;

        // Get correct answer - support both 'Correct' and 'Correct Answer' field names
        // Also handle lowercase and ensure it's a valid letter (A, B, C, D)
        const correctValue = question.Correct || question['Correct Answer'] || '';
        const correctLetter = String(correctValue).toUpperCase().trim();
        const correctAnswerIndex = correctLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

        // Validate that correctAnswerIndex is valid (0-3)
        const isValidCorrectAnswer = correctAnswerIndex >= 0 && correctAnswerIndex <= 3;
        const isCorrect = hasAnswered && isValidCorrectAnswer && (userAnswer === correctAnswerIndex);

        // Score calculation: +1 correct, -0.25 wrong, 0 unanswered
        // Main passage questions have NO marks - only sub-questions are scored
        let points = 0;
        if (!isMainPassage) {
            if (hasAnswered) {
                points = isCorrect ? 1 : -0.25;
                score += points;
            }
        }

        // Calculate hierarchical question number for display
        const hierarchicalNum = getHierarchicalQuestionNumber(index);

        // Store detailed answer info
        detailedAnswers.push({
            questionId: question.ID,
            subject: question.Subject,
            question: question.Question,
            optionA: question['Option A'],
            optionB: question['Option B'],
            optionC: question['Option C'],
            optionD: question['Option D'],
            userAnswer: isMainPassage ? 'N/A (Passage)' : (hasAnswered ? ['A', 'B', 'C', 'D'][userAnswer] : 'Not Answered'),
            correctAnswer: isMainPassage ? 'N/A' : (correctLetter || question.Correct),
            isCorrect: isMainPassage ? null : isCorrect,
            points: points,
            isSubQuestion: isSubQuestion,
            isMainPassage: isMainPassage,
            parentQuestionId: parentQuestionId || null,
            subQuestionOrder: question['Sub Question Order'] || null,
            hierarchicalNumber: hierarchicalNum.display
        });
    });

    // Get candidate info (both are now mandatory)
    const candidateName = document.getElementById('candidate-name').value.trim();
    const candidateMobile = document.getElementById('candidate-mobile').value.trim();

    // Save result to database if API is available
    if (window.PoliteCCAPI && window.PoliteCCAPI.submitResultToDatabase) {
        // Check for duplicate submission (same name + mobile for this exam)
        const existingResults = await window.PoliteCCAPI.getExamResults(currentExam.code) || [];
        const duplicate = existingResults.find(r =>
            (r.Name === candidateName && r.Mobile === candidateMobile)
        );

        if (duplicate) {
            window.PoliteCCAPI.showNotification('⚠️ You have already submitted this exam!', 'error');
            return; // Prevent submission
        } else {
            // Ensure score has exactly 2 decimal places without rounding to integer
            const finalScore = Math.round(score * 100) / 100;
            const resultData = {
                'Name': candidateName,
                'Mobile': candidateMobile,
                'Score': finalScore,
                'Answers': JSON.stringify(detailedAnswers),
                'examCode': currentExam.code,
                'examTitle': currentExam.title
            };

            // Only add Exam linked record field if examId is valid
            if (currentExam.examId) {
                resultData['examId'] = currentExam.examId;
            }

            const submitted = await window.PoliteCCAPI.submitResultToDatabase(resultData);
            if (!submitted) {
                window.PoliteCCAPI.showNotification('❌ Failed to submit exam. Please try again.', 'error');
                return; // Don't show result screen if submission failed
            }
        }
    }

    // Store detailed answers for candidate viewing
    // Use precise score calculation: Math.round(score * 100) / 100 for 2 decimal places
    const displayScore = Math.round(score * 100) / 100;
    candidateDetailedAnswers = {
        candidateName: candidateName,
        candidateMobile: candidateMobile,
        examCode: currentExam.code,
        examTitle: currentExam.title,
        score: displayScore,
        answers: detailedAnswers
    };

    // Calculate detailed statistics
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let totalMarks = 0;

    detailedAnswers.forEach(answer => {
        if (answer.isMainPassage) return; // Skip passages
        totalMarks++;
        if (answer.userAnswer === 'Not Answered') {
            unansweredCount++;
        } else if (answer.isCorrect) {
            correctCount++;
        } else {
            wrongCount++;
        }
    });

    const percentage = totalMarks > 0 ? ((displayScore / totalMarks) * 100).toFixed(1) : 0;

    // Show result screen
    document.getElementById('exam-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('active');
    updateHeaderNav('result-screen');

    // Update all result screen elements
    document.getElementById('final-score').textContent = displayScore.toFixed(2);
    document.getElementById('result-exam-code').textContent = currentExam.code;
    document.getElementById('result-name').textContent = candidateName;
    document.getElementById('result-mobile').textContent = candidateMobile;

    // Update new statistics elements
    const resultTotalMarks = document.getElementById('result-total-marks');
    const resultPercentage = document.getElementById('result-percentage');
    const resultCorrect = document.getElementById('result-correct');
    const resultWrong = document.getElementById('result-wrong');
    const resultUnanswered = document.getElementById('result-unanswered');

    if (resultTotalMarks) resultTotalMarks.textContent = totalMarks;
    if (resultPercentage) resultPercentage.textContent = percentage + '%';
    if (resultCorrect) resultCorrect.textContent = correctCount;
    if (resultWrong) resultWrong.textContent = wrongCount;
    if (resultUnanswered) resultUnanswered.textContent = unansweredCount;

    // Render detailed results in the new UI
    const detailedResultsContainer = document.getElementById('detailed-results');
    if (detailedResultsContainer) {
        let detailedHtml = '';
        detailedAnswers.forEach((answer, index) => {
            if (answer.isMainPassage) return; // Skip passages

            const statusColor = answer.isCorrect ? 'success' : (answer.userAnswer !== 'Not Answered' ? 'error' : 'warning');
            const statusIcon = answer.isCorrect ? '✅' : (answer.userAnswer !== 'Not Answered' ? '❌' : '⚪');
            const statusText = answer.isCorrect ? 'Correct (+1)' : (answer.userAnswer !== 'Not Answered' ? 'Wrong (-0.25)' : 'Unanswered (0)');

            detailedHtml += `
                <div class="card bg-base-200 shadow-sm">
                    <div class="card-body p-4">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-${statusColor}">${statusIcon} Question ${answer.hierarchicalNumber || (index + 1)}</h4>
                            <span class="badge badge-${statusColor}">${statusText}</span>
                        </div>
                        <p class="text-sm mt-2">${answer.question ? answer.question.substring(0, 200) + (answer.question.length > 200 ? '...' : '') : ''}</p>
                        <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                            <div class="${answer.userAnswer === 'A' ? 'font-bold text-primary' : ''} ${answer.correctAnswer === 'A' ? 'text-success' : ''}">A: ${answer.optionA || ''}</div>
                            <div class="${answer.userAnswer === 'B' ? 'font-bold text-primary' : ''} ${answer.correctAnswer === 'B' ? 'text-success' : ''}">B: ${answer.optionB || ''}</div>
                            <div class="${answer.userAnswer === 'C' ? 'font-bold text-primary' : ''} ${answer.correctAnswer === 'C' ? 'text-success' : ''}">C: ${answer.optionC || ''}</div>
                            <div class="${answer.userAnswer === 'D' ? 'font-bold text-primary' : ''} ${answer.correctAnswer === 'D' ? 'text-success' : ''}">D: ${answer.optionD || ''}</div>
                        </div>
                        <div class="flex gap-4 mt-2 text-sm">
                            <span>Your Answer: <strong class="${answer.userAnswer !== 'Not Answered' ? 'text-primary' : 'text-warning'}">${answer.userAnswer}</strong></span>
                            <span>Correct: <strong class="text-success">${answer.correctAnswer}</strong></span>
                        </div>
                    </div>
                </div>
            `;
        });
        detailedResultsContainer.innerHTML = detailedHtml || '<p class="text-center text-base-content/60">No detailed results available</p>';
    }

    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `✅ Exam submitted! Final score: ${displayScore.toFixed(2)} (${correctCount} correct, ${wrongCount} wrong)`;
    document.getElementById('notification-container').appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Helper function to calculate hierarchical question number
function getHierarchicalQuestionNumber(questionIndex) {
    if (!currentExam || !currentExam.questions) return { display: questionIndex + 1, isSubQ: false };

    const question = currentExam.questions[questionIndex];
    const isSubQuestion = question['Is Sub Question'] === true || question['Is Sub Question'] === 'true';
    const parentQuestionId = question['Parent Question ID'];
    const subQuestionOrder = question['Sub Question Order'];

    if (isSubQuestion && parentQuestionId) {
        // Find the parent question's position in the exam
        const parentIndex = currentExam.questions.findIndex(q => q.ID === parentQuestionId);
        if (parentIndex !== -1) {
            const parentNum = parentIndex + 1;
            const subOrder = subQuestionOrder || 1;
            return { display: `${parentNum}.${subOrder}`, isSubQ: true, parentNum, subOrder };
        }
    }

    return { display: questionIndex + 1, isSubQ: false };
}

// Select option in the new UI
function selectOptionNewUI(optionIndex) {
    const optionsContainer = document.getElementById('options-container');
    if (!optionsContainer) return;

    const options = optionsContainer.querySelectorAll('.option');
    const radios = optionsContainer.querySelectorAll('.option-radio');

    // Check if clicking the same option again (toggle off)
    if (userAnswers[currentQuestionIndex] === optionIndex) {
        // Deselect - user wants to not answer this question
        userAnswers[currentQuestionIndex] = undefined;
        options[optionIndex].classList.remove('selected', 'border-primary');
        options[optionIndex].classList.add('border-base-300');
        radios[optionIndex].checked = false;
    } else {
        // Select new option
        userAnswers[currentQuestionIndex] = optionIndex;
        options.forEach((option, i) => {
            if (i === optionIndex) {
                option.classList.remove('border-base-300');
                option.classList.add('selected', 'border-primary');
                radios[i].checked = true;
            } else {
                option.classList.remove('selected', 'border-primary');
                option.classList.add('border-base-300');
                radios[i].checked = false;
            }
        });
    }

    // Update question navigator
    updateQuestionNavigator();

    // Save exam state after answer selection for resume functionality
    saveExamState();
}

// Update the question navigator buttons in the new UI
function updateQuestionNavigator() {
    const navigator = document.getElementById('question-navigator');
    if (!navigator || !currentExam || !currentExam.questions) return;

    // Build navigator buttons showing answered/current status
    let navHtml = '';
    let displayNum = 0;

    for (let i = 0; i < currentExam.questions.length; i++) {
        const q = currentExam.questions[i];
        const qHasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
        const isChild = qHasParentLink || q.isSubQuestion || q['Is Sub Question'];

        // Skip child questions in navigator (they're shown with parent)
        if (isChild) continue;

        displayNum++;
        const isAnswered = userAnswers[i] !== null && userAnswers[i] !== undefined;
        const isCurrent = i === currentQuestionIndex;

        let btnClass = 'btn btn-sm ';
        if (isCurrent) {
            btnClass += 'btn-primary';
        } else if (isAnswered) {
            btnClass += 'btn-success';
        } else {
            btnClass += 'btn-ghost border border-base-300';
        }

        navHtml += `<button class="${btnClass}" data-question-index="${i}">${displayNum}</button>`;
    }

    navigator.innerHTML = navHtml;

    // Add click handlers to navigator buttons
    navigator.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-question-index'));
            currentQuestionIndex = idx;
            loadQuestion();
            saveExamState();
        });
    });
}

// Clear response button handler
const clearResponseBtn = document.getElementById('clear-response-btn');
if (clearResponseBtn) {
    clearResponseBtn.addEventListener('click', function() {
        if (currentQuestionIndex !== undefined && userAnswers) {
            userAnswers[currentQuestionIndex] = undefined;
            loadQuestion();
            saveExamState();
            if (window.PoliteCCAPI && window.PoliteCCAPI.showNotification) {
                window.PoliteCCAPI.showNotification('Response cleared', 'info');
            }
        }
    });
}

// Question loading - supports both standalone and parent-child grouped questions
function loadQuestion() {
    if (!currentExam || currentQuestionIndex >= currentExam.questions.length) return;

    const question = currentExam.questions[currentQuestionIndex];

    // Check if this is a parent question with children
    const questionType = question['Question Type'];
    const hasParentLink = question['Parent Question'] && question['Parent Question'].length > 0;

    // Check if this question is a child (skip it - it's shown with parent)
    const isChildQuestion = hasParentLink || question.isSubQuestion || question['Is Sub Question'];
    if (isChildQuestion) {
        // This is a child question - find and show its parent or next non-child question
        // Try to find the parent
        const parentLink = question['Parent Question'];
        if (parentLink && parentLink.length > 0) {
            const parentIndex = currentExam.questions.findIndex(q => q.id === parentLink[0]);
            if (parentIndex >= 0) {
                currentQuestionIndex = parentIndex;
                loadQuestion(); // Recursively load the parent
                return;
            }
        }
        // If no parent found, skip to next non-child
        while (currentQuestionIndex < currentExam.questions.length) {
            const q = currentExam.questions[currentQuestionIndex];
            const qHasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
            if (!qHasParentLink && !q.isSubQuestion && !q['Is Sub Question']) break;
            currentQuestionIndex++;
        }
        if (currentQuestionIndex < currentExam.questions.length) {
            loadQuestion();
        }
        return;
    }

    // Use Airtable record ID for matching (question.id), not custom ID (question.ID)
    const parentRecordId = question.id;

    // Find children for this parent using Airtable record ID
    let childQuestions = currentExam.questions.filter(q => {
        const qParentLink = q['Parent Question'];
        // Match using Airtable record ID from Parent Question linked field
        if (qParentLink && qParentLink.length > 0 && qParentLink[0] === parentRecordId) {
            return true;
        }
        // Fallback: also check if parentQuestionId or Parent Question ID matches custom ID
        if (q.parentQuestionId === question.ID || q['Parent Question ID'] === question.ID) {
            return true;
        }
        return false;
    });

    // Determine if this is a parent question
    const isParentQuestion = (questionType === 'Parent-child' && !hasParentLink) ||
                            question['Main Question Text'] ||
                            question.hasSubQuestions ||
                            question.isParent ||
                            childQuestions.length > 0; // Has children = is a parent

    const standaloneContainer = document.getElementById('standalone-question-container');
    const parentChildContainer = document.getElementById('parent-child-question-container');

    // Calculate total scorable questions (questions with options that can earn marks)
    // This includes: standalone questions AND child questions (sub-questions)
    // This excludes: parent passages (they don't have options/marks directly)
    let totalScorableQuestions = 0;
    let currentScorableStartNum = 0; // Starting scorable question number for current group/question
    const processedParents = new Set();

    // First pass: count total scorable questions
    for (let i = 0; i < currentExam.questions.length; i++) {
        const q = currentExam.questions[i];
        // A question is scorable if it has options (Option A exists and is not empty)
        const hasOptions = q['Option A'] && q['Option A'].trim() !== '';
        if (hasOptions) {
            totalScorableQuestions++;
        }
    }

    // Second pass: calculate starting scorable number for current question
    let scorableCount = 0;
    for (let i = 0; i < currentQuestionIndex; i++) {
        const q = currentExam.questions[i];
        const hasOptions = q['Option A'] && q['Option A'].trim() !== '';
        if (hasOptions) {
            scorableCount++;
        }
    }
    currentScorableStartNum = scorableCount + 1;

    // For display, still show the "group" number (parent-child as one visual unit)
    let displayQuestionNum = 1;
    let totalDisplayGroups = 0;

    for (let i = 0; i < currentExam.questions.length; i++) {
        const q = currentExam.questions[i];
        const qHasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
        const qIsChild = qHasParentLink || q.isSubQuestion || q['Is Sub Question'];

        if (!qIsChild) {
            totalDisplayGroups++;
            if (i < currentQuestionIndex) {
                displayQuestionNum++;
            }
        }
    }

    // Update question number display based on type
    const questionNumberDisplay = document.querySelector('#standalone-question-container .question-number');
    const progressDisplay = document.querySelector('.progress');

    if (isParentQuestion && childQuestions.length > 0) {
        // Parent-child group: show range "Question X to Y of Z"
        const endNum = currentScorableStartNum + childQuestions.length - 1;
        if (questionNumberDisplay) {
            questionNumberDisplay.innerHTML = `Question <span id="current-q-num">${currentScorableStartNum} to ${endNum}</span> of <span id="total-questions">${totalScorableQuestions}</span>`;
        }
        if (progressDisplay) {
            progressDisplay.innerHTML = `Question <span id="progress-num">${displayQuestionNum}</span> of <span id="progress-total">${totalDisplayGroups}</span> groups`;
        }
    } else {
        // Standalone: show "Question X of Z"
        if (questionNumberDisplay) {
            questionNumberDisplay.innerHTML = `Question <span id="current-q-num">${currentScorableStartNum}</span> of <span id="total-questions">${totalScorableQuestions}</span>`;
        }
        if (progressDisplay) {
            progressDisplay.innerHTML = `Question <span id="progress-num">${currentScorableStartNum}</span> of <span id="progress-total">${totalScorableQuestions}</span>`;
        }
    }

    if (isParentQuestion && childQuestions.length > 0) {
        // Display parent-child group
        standaloneContainer.style.display = 'none';
        parentChildContainer.style.display = 'block';

        const endScorableNum = currentScorableStartNum + childQuestions.length - 1;
        const passageContent = escapeHtmlForRichContent(question.Question || question['Main Question Text'] || '');

        // ===== UPDATE NEW UI ELEMENTS FOR PARENT-CHILD =====
        // Update question numbers in new UI
        const currentQuestionNum = document.getElementById('current-question-num');
        const totalQuestionsNum = document.getElementById('total-questions-num');
        if (currentQuestionNum) currentQuestionNum.textContent = `${currentScorableStartNum}-${endScorableNum}`;
        if (totalQuestionsNum) totalQuestionsNum.textContent = totalScorableQuestions;

        // Show parent passage in the new UI
        const parentQuestionContainer = document.getElementById('parent-question-container');
        const parentQuestionText = document.getElementById('parent-question-text');
        if (parentQuestionContainer && parentQuestionText) {
            parentQuestionContainer.classList.remove('hidden');
            renderRichContent(question.Question || question['Main Question Text'] || '', parentQuestionText);
        }

        // Hide regular question display
        const questionDisplay = document.getElementById('question-display');
        if (questionDisplay) {
            questionDisplay.innerHTML = `<div class="text-sm text-base-content/60">📖 See passage above. Answer the sub-questions below.</div>`;
        }

        // Sort children by order
        childQuestions.sort((a, b) => {
            const orderA = parseInt(a['Sub Question Number']) || parseInt(a['Sub Question Order']) || 0;
            const orderB = parseInt(b['Sub Question Number']) || parseInt(b['Sub Question Order']) || 0;
            return orderA - orderB;
        });

        // Render child questions in the new UI options container
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            let childrenHtml = '';
            childQuestions.forEach((child, childIdx) => {
                const childIndex = currentExam.questions.indexOf(child);
                const childAnswer = userAnswers[childIndex];
                const childNum = childIdx + 1;

                const optionLetters = ['A', 'B', 'C', 'D'];
                const optionValues = [
                    child['Option A'] || '',
                    child['Option B'] || '',
                    child['Option C'] || '',
                    child['Option D'] || ''
                ];

                childrenHtml += `
                    <div class="card bg-base-200 shadow-sm mb-4 child-question-card" data-child-index="${childIndex}">
                        <div class="card-body p-4">
                            <h4 class="font-bold text-primary mb-2">Question ${displayQuestionNum}.${childNum}</h4>
                            <p class="mb-3 rich-content">${escapeHtmlForRichContent(child.Question || '')}</p>
                            <div class="space-y-2 child-options" data-child-index="${childIndex}">
                                ${optionValues.map((opt, idx) => {
                                    const isSelected = childAnswer === idx;
                                    return `
                                        <div class="option child-option flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-base-100 ${isSelected ? 'border-primary bg-primary/10' : 'border-base-300'}" data-index="${idx}" data-child-index="${childIndex}">
                                            <input type="radio" name="child-answer-${childIndex}" class="radio radio-primary option-radio child-radio" ${isSelected ? 'checked' : ''}>
                                            <span class="font-bold text-primary option-letter">${optionLetters[idx]}</span>
                                            <span class="flex-1 rich-content">${escapeHtmlForRichContent(opt)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            });
            optionsContainer.innerHTML = childrenHtml;

            // Add click handlers for child options in the new UI
            optionsContainer.querySelectorAll('.child-option').forEach(option => {
                option.addEventListener('click', function() {
                    const childIndex = parseInt(this.getAttribute('data-child-index'));
                    const optionIndex = parseInt(this.getAttribute('data-index'));

                    const siblings = optionsContainer.querySelectorAll(`.child-option[data-child-index="${childIndex}"]`);
                    const radios = optionsContainer.querySelectorAll(`input[name="child-answer-${childIndex}"]`);

                    if (userAnswers[childIndex] === optionIndex) {
                        // Deselect
                        userAnswers[childIndex] = undefined;
                        this.classList.remove('border-primary', 'bg-primary/10');
                        this.classList.add('border-base-300');
                        if (radios[optionIndex]) radios[optionIndex].checked = false;
                    } else {
                        // Select
                        userAnswers[childIndex] = optionIndex;
                        siblings.forEach(s => {
                            s.classList.remove('border-primary', 'bg-primary/10');
                            s.classList.add('border-base-300');
                        });
                        this.classList.remove('border-base-300');
                        this.classList.add('border-primary', 'bg-primary/10');
                        if (radios[optionIndex]) radios[optionIndex].checked = true;
                    }

                    updateQuestionNavigator();
                    saveExamState();
                });
            });
        }
        let groupHtml = `
            <div class="question-container" style="background: linear-gradient(135deg, #faf5ff 0%, #f3e5f5 100%); border: 2px solid #9c27b0; max-height: 65vh; overflow-y: auto;">
                <!-- Group Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; position: sticky; top: 0; background: #f3e5f5; padding: 10px; margin: -20px -20px 15px -20px; border-radius: 10px 10px 0 0;">
                    <div class="question-tag" style="background: #9c27b0;">📋 Question ${currentScorableStartNum} to ${endScorableNum} of ${totalScorableQuestions}</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="background: #9c27b0; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">${childQuestions.length} Sub-Questions</span>
                        <span style="background: #4caf50; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">Max: ${childQuestions.length} marks</span>
                    </div>
                </div>

                <!-- Parent Passage with rich content support -->
                <div style="background: white; border-left: 4px solid #9c27b0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="color: #9c27b0; font-weight: 700; margin-bottom: 10px; font-size: 1rem;">📖 Passage / Context:</div>
                    <div class="rich-content" style="color: #333; font-size: 1.05rem; line-height: 1.8;">${passageContent}</div>
                </div>

                <!-- Sub-Questions -->
                <div style="color: #7b1fa2; font-weight: 700; margin-bottom: 15px; font-size: 0.95rem; border-top: 2px dashed #ce93d8; padding-top: 15px;">
                    Answer all ${childQuestions.length} sub-questions below:
                </div>
        `;

        // Sort children by order
        childQuestions.sort((a, b) => {
            const orderA = parseInt(a['Sub Question Number']) || parseInt(a['Sub Question Order']) || 0;
            const orderB = parseInt(b['Sub Question Number']) || parseInt(b['Sub Question Order']) || 0;
            return orderA - orderB;
        });

        // Render each child question with its options
        childQuestions.forEach((child, childIdx) => {
            const childIndex = currentExam.questions.indexOf(child);
            const childAnswer = userAnswers[childIndex];
            const childNum = childIdx + 1;
            const childId = child.ID || `${question.ID}.${childNum}`;

            // Escape content for rich rendering
            const childQuestionContent = escapeHtmlForRichContent(child.Question || '');
            const optAContent = escapeHtmlForRichContent(child['Option A'] || '');
            const optBContent = escapeHtmlForRichContent(child['Option B'] || '');
            const optCContent = escapeHtmlForRichContent(child['Option C'] || '');
            const optDContent = escapeHtmlForRichContent(child['Option D'] || '');

            groupHtml += `
                <div class="sub-question-block" style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #9c27b0;" data-child-index="${childIndex}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-weight: 700; color: #9c27b0; font-size: 1rem;">
                            ${displayQuestionNum}.${childNum} ${childId}
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <span style="background: #e8f5e9; color: #388e3c; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">+1</span>
                            <span style="background: #ffebee; color: #c62828; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem;">-0.25</span>
                        </div>
                    </div>
                    <div class="rich-content" style="font-size: 1rem; line-height: 1.6; margin-bottom: 12px; color: #333;">${childQuestionContent}</div>
                    <div class="options child-options" data-child-index="${childIndex}">
                        <div class="option child-option ${childAnswer === 0 ? 'selected' : ''}" data-index="0" data-child-index="${childIndex}">
                            <input type="radio" name="child-answer-${childIndex}" class="option-radio child-radio" ${childAnswer === 0 ? 'checked' : ''}>
                            <span class="option-letter">A</span>
                            <span class="rich-content">${optAContent}</span>
                        </div>
                        <div class="option child-option ${childAnswer === 1 ? 'selected' : ''}" data-index="1" data-child-index="${childIndex}">
                            <input type="radio" name="child-answer-${childIndex}" class="option-radio child-radio" ${childAnswer === 1 ? 'checked' : ''}>
                            <span class="option-letter">B</span>
                            <span class="rich-content">${optBContent}</span>
                        </div>
                        <div class="option child-option ${childAnswer === 2 ? 'selected' : ''}" data-index="2" data-child-index="${childIndex}">
                            <input type="radio" name="child-answer-${childIndex}" class="option-radio child-radio" ${childAnswer === 2 ? 'checked' : ''}>
                            <span class="option-letter">C</span>
                            <span class="rich-content">${optCContent}</span>
                        </div>
                        <div class="option child-option ${childAnswer === 3 ? 'selected' : ''}" data-index="3" data-child-index="${childIndex}">
                            <input type="radio" name="child-answer-${childIndex}" class="option-radio child-radio" ${childAnswer === 3 ? 'checked' : ''}>
                            <span class="option-letter">D</span>
                            <span class="rich-content">${optDContent}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        groupHtml += `</div>`;
        parentChildContainer.innerHTML = groupHtml;

        // Process rich content (render math expressions) in the parent-child container
        processRichContentInContainer(parentChildContainer);

        // Add click handlers for child options
        parentChildContainer.querySelectorAll('.child-option').forEach(option => {
            option.addEventListener('click', function() {
                const childIndex = parseInt(this.dataset.childIndex);
                const optionIndex = parseInt(this.dataset.index);

                // Toggle selection
                const siblings = parentChildContainer.querySelectorAll(`.child-option[data-child-index="${childIndex}"]`);
                const radios = parentChildContainer.querySelectorAll(`input[name="child-answer-${childIndex}"]`);

                if (userAnswers[childIndex] === optionIndex) {
                    // Deselect
                    userAnswers[childIndex] = undefined;
                    siblings.forEach(s => s.classList.remove('selected'));
                    radios.forEach(r => r.checked = false);
                } else {
                    // Select
                    userAnswers[childIndex] = optionIndex;
                    siblings.forEach(s => s.classList.remove('selected'));
                    this.classList.add('selected');
                    radios[optionIndex].checked = true;
                }

                // Save state
                if (typeof saveExamState === 'function') {
                    saveExamState();
                }
            });
        });

    } else {
        // Display standalone question
        standaloneContainer.style.display = 'block';
        parentChildContainer.style.display = 'none';

        // Update hidden elements for compatibility
        const subjectDisplay = document.getElementById('question-subject-display');
        if (subjectDisplay) subjectDisplay.textContent = question.Subject || 'Unknown';

        const questionTextDisplay = document.getElementById('question-text-display');
        if (questionTextDisplay) {
            renderRichContent(question.Question || 'Loading question...', questionTextDisplay);
        }

        // Render options to hidden elements for compatibility
        const optADisplay = document.getElementById('option-a-display');
        const optBDisplay = document.getElementById('option-b-display');
        const optCDisplay = document.getElementById('option-c-display');
        const optDDisplay = document.getElementById('option-d-display');
        if (optADisplay) renderRichContent(question['Option A'] || 'Option A', optADisplay, true);
        if (optBDisplay) renderRichContent(question['Option B'] || 'Option B', optBDisplay, true);
        if (optCDisplay) renderRichContent(question['Option C'] || 'Option C', optCDisplay, true);
        if (optDDisplay) renderRichContent(question['Option D'] || 'Option D', optDDisplay, true);

        // ===== UPDATE NEW UI ELEMENTS =====
        // Update the visible question display in exam screen
        const questionDisplay = document.getElementById('question-display');
        if (questionDisplay) {
            renderRichContent(question.Question || 'Loading question...', questionDisplay);
        }

        // Update question number in new UI
        const currentQuestionNum = document.getElementById('current-question-num');
        const totalQuestionsNum = document.getElementById('total-questions-num');
        if (currentQuestionNum) currentQuestionNum.textContent = currentScorableStartNum;
        if (totalQuestionsNum) totalQuestionsNum.textContent = totalScorableQuestions;

        // Render options to the visible options container
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            const optionLetters = ['A', 'B', 'C', 'D'];
            const optionValues = [
                question['Option A'] || 'Option A',
                question['Option B'] || 'Option B',
                question['Option C'] || 'Option C',
                question['Option D'] || 'Option D'
            ];

            // Clone container to remove old event listeners
            const newOptionsContainer = optionsContainer.cloneNode(false);
            newOptionsContainer.id = 'options-container'; // Preserve the ID
            optionsContainer.parentNode.replaceChild(newOptionsContainer, optionsContainer);

            newOptionsContainer.innerHTML = optionValues.map((opt, idx) => {
                const isSelected = userAnswers[currentQuestionIndex] === idx;
                return `
                    <div class="option flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-base-200 ${isSelected ? 'selected border-primary' : 'border-base-300'}" data-index="${idx}">
                        <input type="radio" name="answer" class="radio radio-primary option-radio" style="pointer-events: none;" ${isSelected ? 'checked' : ''}>
                        <span class="font-bold text-primary option-letter">${optionLetters[idx]}</span>
                        <span class="flex-1 rich-content">${escapeHtmlForRichContent(opt)}</span>
                    </div>
                `;
            }).join('');

            // Add click handler to the new container
            newOptionsContainer.addEventListener('click', function(e) {
                const option = e.target.closest('.option');
                if (option) {
                    const optionIndex = parseInt(option.getAttribute('data-index'));
                    selectOptionNewUI(optionIndex);
                }
            });

            // Process LaTeX/math content in options
            processRichContentInContainer(newOptionsContainer);
        }

        // Hide parent question container for standalone questions
        const parentQuestionContainer = document.getElementById('parent-question-container');
        if (parentQuestionContainer) {
            parentQuestionContainer.classList.add('hidden');
        }

        // Update selected option in hidden standalone-options for compatibility
        const options = document.querySelectorAll('#standalone-options .option');
        const radios = document.querySelectorAll('#standalone-options .option-radio');
        options.forEach((option, index) => {
            if (userAnswers[currentQuestionIndex] === index) {
                option.classList.add('selected');
                if (radios[index]) radios[index].checked = true;
            } else {
                option.classList.remove('selected');
                if (radios[index]) radios[index].checked = false;
            }
        });
    }

    // Update question navigator
    updateQuestionNavigator();

    // Update navigation buttons
    document.getElementById('prev-btn').disabled = (currentQuestionIndex === 0);

    // Check if this is the last displayable question
    let isLastQuestion = true;
    for (let i = currentQuestionIndex + 1; i < currentExam.questions.length; i++) {
        const q = currentExam.questions[i];
        const qHasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
        const qIsChild = qHasParentLink || q.isSubQuestion || q['Is Sub Question'];
        if (!qIsChild) {
            isLastQuestion = false;
            break;
        }
    }

    // Show/hide floating submit button based on whether this is the last question
    const floatingSubmitContainer = document.getElementById('floating-submit-container');
    if (floatingSubmitContainer) {
        if (isLastQuestion) {
            floatingSubmitContainer.classList.remove('hidden');
            document.getElementById('next-btn').style.display = 'none';
        } else {
            floatingSubmitContainer.classList.add('hidden');
            document.getElementById('next-btn').style.display = 'block';
        }
    }
}

    // Initialize Flatpickr for expiry date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiryInput = document.getElementById('exam-expiry');
    if (expiryInput && typeof flatpickr !== 'undefined') {
        const fp = flatpickr(expiryInput, {
            dateFormat: "d-m-Y",         // Display format: dd-mm-yyyy
            defaultDate: tomorrow,       // Set default to tomorrow
            minDate: "today",            // Prevent selecting past dates
            allowInput: true,            // Allow manual keyboard input
            clickOpens: true,            // Open calendar on click
            disableMobile: true,         // Use Flatpickr on mobile too (not native picker)
            onReady: function(selectedDates, dateStr, instance) {
                // Ensure calendar is visible above other elements
                instance.calendarContainer.style.zIndex = '99999';
            }
        });
        // Store reference for potential cleanup
        window.expiryDatePicker = fp;
    }

    // Check if user is already logged in (do this AFTER all event handlers are attached)
    try {
        const session = getSession();
        if (session) {
            if (session.userType === 'candidate') {
                showCandidateDashboard(session.userData);
                // Check if there's a saved exam in progress
                checkAndResumeExam();
            } else if (session.userType === 'admin') {
                document.getElementById('hero-landing').classList.remove('active');
                document.getElementById('admin-panel').classList.add('active');
                updateHeaderNav('admin-panel');
                // Auto-load questions when admin session is restored
                document.getElementById('question-bank-btn').click();
            }
        }
    } catch (e) {
        console.error('Session check error:', e);
    }
}); // End of DOMContentLoaded

// =====================================================
// PARENT-CHILD QUESTION CREATION HANDLERS
// =====================================================

let childQuestionCount = 0;

// Toggle between standalone and parent-child forms
const questionTypeSelect = document.getElementById('question-type-select');
if (questionTypeSelect) {
    questionTypeSelect.addEventListener('change', function() {
        const type = this.value;
        const standaloneForm = document.getElementById('standalone-form');
        const parentChildForm = document.getElementById('parent-child-form');

        if (type === 'standalone') {
            standaloneForm.style.display = 'block';
            parentChildForm.style.display = 'none';
        } else if (type === 'parent-child') {
            standaloneForm.style.display = 'none';
            parentChildForm.style.display = 'block';

            // Add first child question automatically
            if (childQuestionCount === 0) {
                addChildQuestion();
            }
        } else {
            standaloneForm.style.display = 'none';
            parentChildForm.style.display = 'none';
        }
    });
}

// Add child question to the form
function addChildQuestion() {
    childQuestionCount++;
    const container = document.getElementById('children-container');
    if (!container) return;

    const childHtml = `
        <div class="child-question" id="child-${childQuestionCount}" style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #17a2b8;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h5 style="margin: 0; color: #0c5460;">Child Question ${childQuestionCount}</h5>
                <button type="button" class="remove-child-btn" onclick="removeChildQuestion(${childQuestionCount})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>
            <div class="form-group">
                <label>Question Text:</label>
                <textarea id="child-question-${childQuestionCount}" rows="2" placeholder="Enter the sub-question here..."></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label>Option A:</label>
                    <input type="text" id="child-option-a-${childQuestionCount}" placeholder="Option A">
                </div>
                <div class="form-group">
                    <label>Option B:</label>
                    <input type="text" id="child-option-b-${childQuestionCount}" placeholder="Option B">
                </div>
                <div class="form-group">
                    <label>Option C:</label>
                    <input type="text" id="child-option-c-${childQuestionCount}" placeholder="Option C">
                </div>
                <div class="form-group">
                    <label>Option D:</label>
                    <input type="text" id="child-option-d-${childQuestionCount}" placeholder="Option D">
                </div>
            </div>
            <div class="form-group">
                <label>Correct Answer:</label>
                <select id="child-correct-${childQuestionCount}">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                </select>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', childHtml);
}

// Remove child question
window.removeChildQuestion = function(num) {
    const child = document.getElementById(`child-${num}`);
    if (child) {
        child.remove();
    }
};

// Add child button handler
const addChildBtn = document.getElementById('add-child-btn');
if (addChildBtn) {
    addChildBtn.addEventListener('click', function(e) {
        e.preventDefault();
        addChildQuestion();
    });
}

// Create standalone question
const createStandaloneBtn = document.getElementById('create-standalone-btn');
if (createStandaloneBtn) {
    createStandaloneBtn.addEventListener('click', async function() {
        try {
            const id = document.getElementById('standalone-id').value.trim();
            const subject = document.getElementById('standalone-subject').value;
            const question = document.getElementById('standalone-question').value.trim();
            const optionA = document.getElementById('standalone-option-a').value.trim();
            const optionB = document.getElementById('standalone-option-b').value.trim();
            const optionC = document.getElementById('standalone-option-c').value.trim();
            const optionD = document.getElementById('standalone-option-d').value.trim();
            const correct = document.getElementById('standalone-correct').value;
            const difficulty = document.getElementById('standalone-difficulty').value;

            if (!question || !optionA || !optionB || !optionC || !optionD) {
                window.PoliteCCAPI.showNotification('Please fill in all required fields', 'error');
                return;
            }

            const questionData = {
                subject: subject,
                difficulty: difficulty,
                question: question,
                optionA: optionA,
                optionB: optionB,
                optionC: optionC,
                optionD: optionD,
                correct: correct
            };

            if (id) {
                questionData.ID = id;
            }

            const result = await window.PoliteCCAPI.addQuestionToDatabase(questionData);

            if (result) {
                window.PoliteCCAPI.showNotification('Standalone question created successfully!', 'success');

                // Clear form
                document.getElementById('standalone-id').value = '';
                document.getElementById('standalone-question').value = '';
                document.getElementById('standalone-option-a').value = '';
                document.getElementById('standalone-option-b').value = '';
                document.getElementById('standalone-option-c').value = '';
                document.getElementById('standalone-option-d').value = '';
                document.getElementById('question-type-select').value = '';
                document.getElementById('standalone-form').style.display = 'none';

                // Refresh question bank
                document.getElementById('question-bank-btn').click();
            }
        } catch (error) {
            console.error('Error creating standalone question:', error);
            window.PoliteCCAPI.showNotification('Failed to create question: ' + error.message, 'error');
        }
    });
}

// Create parent-child question set
const createParentChildBtn = document.getElementById('create-parent-child-btn');
if (createParentChildBtn) {
    createParentChildBtn.addEventListener('click', async function() {
        try {
            const parentId = document.getElementById('parent-id').value.trim();
            const parentSubject = document.getElementById('parent-subject').value;
            const parentText = document.getElementById('parent-text').value.trim();
            const parentDifficulty = document.getElementById('parent-difficulty').value;

            if (!parentText) {
                window.PoliteCCAPI.showNotification('Please enter the parent question/passage text', 'error');
                return;
            }

            // Collect child questions
            const childQuestions = [];
            const childElements = document.querySelectorAll('.child-question');

            for (const childEl of childElements) {
                const num = childEl.id.replace('child-', '');
                const childQuestion = document.getElementById(`child-question-${num}`).value.trim();
                const childOptionA = document.getElementById(`child-option-a-${num}`).value.trim();
                const childOptionB = document.getElementById(`child-option-b-${num}`).value.trim();
                const childOptionC = document.getElementById(`child-option-c-${num}`).value.trim();
                const childOptionD = document.getElementById(`child-option-d-${num}`).value.trim();
                const childCorrect = document.getElementById(`child-correct-${num}`).value;

                if (!childQuestion || !childOptionA || !childOptionB || !childOptionC || !childOptionD) {
                    window.PoliteCCAPI.showNotification(`Please fill in all fields for Child Question ${num}`, 'error');
                    return;
                }

                childQuestions.push({
                    question: childQuestion,
                    optionA: childOptionA,
                    optionB: childOptionB,
                    optionC: childOptionC,
                    optionD: childOptionD,
                    correct: childCorrect
                });
            }

            if (childQuestions.length === 0) {
                window.PoliteCCAPI.showNotification('Please add at least one child question', 'error');
                return;
            }

            // Create parent question first
            const parentData = {
                subject: parentSubject,
                difficulty: parentDifficulty,
                question: parentText,
                'Question Type': 'Parent-child',
                'Main Question Text': parentText
            };

            if (parentId) {
                parentData.ID = parentId;
            }

            const parentResult = await window.PoliteCCAPI.addQuestionToDatabase(parentData);

            if (!parentResult) {
                window.PoliteCCAPI.showNotification('Failed to create parent question', 'error');
                return;
            }

            // Create child questions linked to parent
            let childNum = 1;
            for (const child of childQuestions) {
                const childData = {
                    subject: parentSubject,
                    difficulty: parentDifficulty,
                    question: child.question,
                    optionA: child.optionA,
                    optionB: child.optionB,
                    optionC: child.optionC,
                    optionD: child.optionD,
                    correct: child.correct,
                    'Question Type': 'Parent-child',
                    'Parent Question': [parentResult.id],
                    'Sub Question Number': childNum
                };

                await window.PoliteCCAPI.addQuestionToDatabase(childData);
                childNum++;
            }

            window.PoliteCCAPI.showNotification(`Parent-child question set created with ${childQuestions.length} sub-questions!`, 'success');

            // Clear form
            document.getElementById('parent-id').value = '';
            document.getElementById('parent-text').value = '';
            document.getElementById('children-container').innerHTML = '';
            childQuestionCount = 0;
            document.getElementById('question-type-select').value = '';
            document.getElementById('parent-child-form').style.display = 'none';

            // Refresh question bank
            document.getElementById('question-bank-btn').click();
        } catch (error) {
            console.error('Error creating parent-child question set:', error);
            window.PoliteCCAPI.showNotification('Failed to create question set: ' + error.message, 'error');
        }
    });
}

// ==================== INITIALIZATION SCRIPT ====================

// Register service worker for PWA functionality with update handling
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully:', registration.scope);

            // Check for updates immediately
            registration.update();

            // Check for updates periodically (every 5 minutes)
            setInterval(() => {
                registration.update();
                console.log('Checking for service worker updates...');
            }, 5 * 60 * 1000);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New content is available, refresh automatically
                        console.log('New version available, refreshing...');
                        window.location.reload();
                    }
                });
            });

            // Handle controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('New service worker activated');
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    });
}
