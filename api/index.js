const Airtable = require('airtable');
const crypto = require('crypto');

// =====================================================
// AIRTABLE CONFIGURATION
// =====================================================
const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

const QUESTIONS_TABLE = 'Questions';
const EXAMS_TABLE = 'Exams';
const RESULTS_TABLE = 'Results';
const STUDENTS_TABLE = 'Candidates';  // Changed from 'Students' to match Airtable table name

// =====================================================
// PASSWORD HASHING UTILITIES
// =====================================================
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'polite-salt';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + PASSWORD_SALT).digest('hex');
}

function verifyPassword(password, hashedPassword) {
    return hashPassword(password) === hashedPassword;
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateTempPassword() {
    // Generate a random 8-character alphanumeric password
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// =====================================================
// HIERARCHICAL QUESTION TYPE CONSTANTS
// =====================================================
const QUESTION_TYPES = {
    STANDALONE: 'Standalone',
    PARENT_CHILD: 'Parent-child'
};

// =====================================================
// SECURITY UTILITIES
// =====================================================
function sanitizeForFormula(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
}

// =====================================================
// HIERARCHICAL QUESTION HELPER FUNCTIONS
// =====================================================

/**
 * Get all children of a parent question
 * @param {string} parentRecordId - Airtable record ID of parent
 * @returns {Promise<Array>} Array of child question records
 */
async function getChildQuestions(parentRecordId) {
    try {
        // Find all questions where Parent Question field contains this parent's record ID
        const records = await base(QUESTIONS_TABLE).select({
            filterByFormula: `SEARCH("${parentRecordId}", ARRAYJOIN({Parent Question}))`
        }).all();
        
        return records;
    } catch (error) {
        console.error('Error fetching child questions:', error);
        return [];
    }
}

/**
 * Check if a question is a parent (Parent-child type without parent link)
 */
function isParentQuestion(questionFields) {
    return questionFields['Question Type'] === QUESTION_TYPES.PARENT_CHILD && 
           !questionFields['Parent Question'];
}

/**
 * Cascade delete: Delete all children when parent is deleted
 * @param {string} parentRecordId - Airtable record ID of parent
 * @returns {Promise<number>} Number of children deleted
 */
async function cascadeDeleteChildren(parentRecordId) {
    try {
        const children = await getChildQuestions(parentRecordId);
        
        if (children.length === 0) {
            return 0;
        }

        // Airtable allows max 10 records per destroy call
        const childIds = children.map(child => child.id);
        let deletedCount = 0;
        
        for (let i = 0; i < childIds.length; i += 10) {
            const batch = childIds.slice(i, i + 10);
            await base(QUESTIONS_TABLE).destroy(batch);
            deletedCount += batch.length;
        }
        
        console.log(`🗑️ Cascade deleted ${deletedCount} child questions for parent ${parentRecordId}`);
        return deletedCount;
    } catch (error) {
        console.error('Error in cascade delete:', error);
        throw error;
    }
}

/**
 * Organize questions hierarchically (parents with their children)
 * @param {Array} questions - Flat array of all questions
 * @returns {Array} Hierarchically organized questions
 */
function organizeHierarchically(questions) {
    const parentQuestions = [];
    const childQuestionsMap = new Map();
    const standaloneQuestions = [];

    // First pass: categorize questions
    questions.forEach(q => {
        const questionType = q['Question Type'];
        const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
        
        if (questionType === QUESTION_TYPES.PARENT_CHILD && !hasParentLink) {
            // Parent-child type without parent link = parent question
            parentQuestions.push(q);
        } else if (questionType === QUESTION_TYPES.PARENT_CHILD && hasParentLink) {
            // Parent-child type with parent link = child question
            const parentId = q['Parent Question'][0]; // Record ID
            
            if (!childQuestionsMap.has(parentId)) {
                childQuestionsMap.set(parentId, []);
            }
            childQuestionsMap.get(parentId).push(q);
        } else {
            // Standalone questions (default)
            standaloneQuestions.push(q);
        }
    });

    // Sort children by Sub Question Number
    childQuestionsMap.forEach((children, parentId) => {
        children.sort((a, b) => {
            const numA = a['Sub Question Number'] || 0;
            const numB = b['Sub Question Number'] || 0;
            return numA - numB;
        });
    });

    // Attach children to parents
    const hierarchicalQuestions = parentQuestions.map(parent => {
        const children = childQuestionsMap.get(parent.id) || [];
        return {
            ...parent,
            children: children,
            childCount: children.length,
            isParent: true,
            totalScore: children.length // Each child is worth 1 point
        };
    });

    // Mark standalone questions
    const standaloneMarked = standaloneQuestions.map(q => ({
        ...q,
        children: [],
        childCount: 0,
        isParent: false,
        isStandalone: true
    }));

    // Return all questions: parents with children first, then standalones
    return [...hierarchicalQuestions, ...standaloneMarked];
}

// =====================================================
// MAIN REQUEST HANDLER
// =====================================================
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method } = req;
    
    // Normalize URL - strip query strings and trailing slashes
    let url = req.url;
    try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        url = urlObj.pathname.replace(/\/+$/, '') || '/';
    } catch (e) {
        // If URL parsing fails, use raw URL
        url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
    }

    try {
        // =====================================================
        // HEALTH CHECK
        // =====================================================
        if (url === '/api/health' && method === 'GET') {
            const systemStatus = {
                airtable: { status: 'connected', message: 'Database connected' },
                gemini: { 
                    status: process.env.GEMINI_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.GEMINI_API_KEY ? 'AI service active' : 'API key not configured'
                },
                ocr: {
                    status: process.env.OCR_SPACE_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.OCR_SPACE_API_KEY ? 'OCR service ready' : 'API key not configured'
                }
            };

            return res.status(200).json({
                status: 'ok',
                services: systemStatus,
                timestamp: new Date().toISOString()
            });
        }

        // =====================================================
        // QUESTION ENDPOINTS
        // =====================================================

        // GET /api/questions - List all questions (with hierarchical grouping option)
        if (url.startsWith('/api/questions') && method === 'GET') {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const hierarchical = urlObj.searchParams.get('hierarchical') === 'true';
            
            const records = await base(QUESTIONS_TABLE).select().all();
            const questions = records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            if (hierarchical) {
                // Return hierarchically organized (parents with children)
                const organized = organizeHierarchically(questions);
                return res.status(200).json({
                    success: true,
                    data: organized,
                    count: organized.length,
                    totalQuestions: questions.length
                });
            } else {
                // Return flat list
                return res.status(200).json({
                    success: true,
                    data: questions,
                    count: questions.length
                });
            }
        }

        // POST /api/questions - Create new question
        if (url === '/api/questions' && method === 'POST') {
            const questionData = req.body;

            // Valid fields for Questions table
            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedData = {};
            for (const key of Object.keys(questionData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = questionData[key];
                }
            }

            // Auto-set Question Type if not provided
            if (!cleanedData['Question Type']) {
                // Check if it has Parent Question link
                if (cleanedData['Parent Question']) {
                    // Has parent link = child in parent-child relationship
                    cleanedData['Question Type'] = QUESTION_TYPES.PARENT_CHILD;
                } else {
                    // No parent link = standalone question (default)
                    cleanedData['Question Type'] = QUESTION_TYPES.STANDALONE;
                }
            }

            // Try to create the question, handle single-select field errors gracefully
            let record;
            try {
                record = await base(QUESTIONS_TABLE).create(cleanedData);
            } catch (createError) {
                // Check if error is due to Question Type single-select option not existing
                if (createError.message && createError.message.includes('select option')) {
                    console.log('⚠️ Question Type select options not configured in Airtable, retrying without Question Type field');
                    // Remove Question Type and try again
                    delete cleanedData['Question Type'];
                    record = await base(QUESTIONS_TABLE).create(cleanedData);
                } else {
                    throw createError;
                }
            }

            return res.status(201).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // DELETE /api/questions/:id - Delete question WITH CASCADE for parent questions
        if (url.startsWith('/api/questions/') && method === 'DELETE') {
            const questionId = url.split('/api/questions/')[1];

            // Get the question record
            let questionRecord;
            try {
                questionRecord = await base(QUESTIONS_TABLE).find(questionId);
            } catch (e) {
                // If not found by record ID, try by field ID
                const records = await base(QUESTIONS_TABLE).select({
                    filterByFormula: `{ID} = '${sanitizeForFormula(questionId)}'`
                }).all();
                
                if (records.length > 0) {
                    questionRecord = records[0];
                }
            }

            if (!questionRecord) {
                return res.status(404).json({
                    success: false,
                    error: 'Question not found'
                });
            }

            const isParent = isParentQuestion(questionRecord.fields);
            const questionType = questionRecord.fields['Question Type'];
            let deletedChildCount = 0;

            // CASCADE DELETE: If parent, delete all children first
            if (isParent) {
                console.log(`🗑️ Deleting parent question: ${questionRecord.fields.ID || questionRecord.id}`);
                console.log(`   Type: ${questionType}`);
                console.log(`   Checking for children...`);
                
                deletedChildCount = await cascadeDeleteChildren(questionRecord.id);
                
                if (deletedChildCount > 0) {
                    console.log(`✅ Successfully cascade deleted ${deletedChildCount} child questions`);
                }
            }

            // Delete the main question (parent or standalone)
            await base(QUESTIONS_TABLE).destroy(questionRecord.id);

            const message = deletedChildCount > 0
                ? `Parent question and ${deletedChildCount} child question(s) deleted successfully`
                : 'Question deleted successfully';

            return res.status(200).json({
                success: true,
                message: message,
                deleted: {
                    questionId: questionRecord.id,
                    fieldId: questionRecord.fields.ID,
                    questionType: questionType,
                    childrenDeleted: deletedChildCount
                }
            });
        }

        // PUT /api/questions/:id - Update question
        if (url.startsWith('/api/questions/') && method === 'PUT') {
            const questionId = url.split('/api/questions/')[1];
            const updateData = req.body;

            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedData = {};
            for (const key of Object.keys(updateData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = updateData[key];
                }
            }

            // Try to update, handle single-select field errors gracefully
            let record;
            try {
                record = await base(QUESTIONS_TABLE).update(questionId, cleanedData);
            } catch (updateError) {
                if (updateError.message && updateError.message.includes('select option')) {
                    console.log('⚠️ Question Type select options not configured in Airtable, retrying without Question Type field');
                    delete cleanedData['Question Type'];
                    record = await base(QUESTIONS_TABLE).update(questionId, cleanedData);
                } else {
                    throw updateError;
                }
            }

            return res.status(200).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // POST /api/questions/bulk - Bulk create questions (with hierarchy support)
        if (url === '/api/questions/bulk' && method === 'POST') {
            const { questions } = req.body;

            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid request. Provide an array of questions.'
                });
            }

            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedQuestions = questions.map(q => {
                const cleaned = {};
                for (const key of Object.keys(q)) {
                    if (validFields.includes(key)) {
                        cleaned[key] = q[key];
                    }
                }

                // Auto-set Question Type if not provided
                if (!cleaned['Question Type']) {
                    if (cleaned['Parent Question']) {
                        // Has parent link = child in parent-child relationship
                        cleaned['Question Type'] = QUESTION_TYPES.PARENT_CHILD;
                    } else {
                        // No parent link = standalone (default)
                        cleaned['Question Type'] = QUESTION_TYPES.STANDALONE;
                    }
                }

                return cleaned;
            });

            // Create in batches of 10 (Airtable limit)
            const results = [];
            let retryWithoutQuestionType = false;

            for (let i = 0; i < cleanedQuestions.length; i += 10) {
                const batch = cleanedQuestions.slice(i, i + 10);
                try {
                    // If we already know Question Type doesn't work, skip it
                    const batchToCreate = retryWithoutQuestionType
                        ? batch.map(q => { const { 'Question Type': _, ...rest } = q; return rest; })
                        : batch;
                    const records = await base(QUESTIONS_TABLE).create(batchToCreate);
                    results.push(...records);
                } catch (batchError) {
                    if (batchError.message && batchError.message.includes('select option') && !retryWithoutQuestionType) {
                        console.log('⚠️ Question Type select options not configured in Airtable, retrying batch without Question Type field');
                        retryWithoutQuestionType = true;
                        // Retry this batch without Question Type
                        const batchWithoutType = batch.map(q => {
                            const { 'Question Type': _, ...rest } = q;
                            return rest;
                        });
                        const records = await base(QUESTIONS_TABLE).create(batchWithoutType);
                        results.push(...records);
                    } else {
                        throw batchError;
                    }
                }
            }

            return res.status(201).json({
                success: true,
                message: `Successfully created ${results.length} questions`,
                count: results.length,
                data: results.map(r => ({ id: r.id, ...r.fields }))
            });
        }

        // =====================================================
        // EXAM ENDPOINTS (with hierarchical support)
        // =====================================================

        // GET /api/exams - List all exams
        if (url === '/api/exams' && method === 'GET') {
            const records = await base(EXAMS_TABLE).select().all();
            const exams = records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            return res.status(200).json({
                success: true,
                data: exams
            });
        }

        // GET /api/exams/:code - Get exam by code (with hierarchical questions)
        if (url.startsWith('/api/exams/') && method === 'GET') {
            const examCode = url.split('/api/exams/')[1];

            const records = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${sanitizeForFormula(examCode)}'`
            }).all();

            if (records.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Exam not found'
                });
            }

            const exam = records[0];
            const examData = {
                id: exam.id,
                ...exam.fields
            };

            // Get questions for this exam (hierarchically organized)
            if (examData.Questions && examData.Questions.length > 0) {
                const questionRecords = await Promise.all(
                    examData.Questions.map(qId => base(QUESTIONS_TABLE).find(qId))
                );

                const questions = questionRecords.map(r => ({
                    id: r.id,
                    ...r.fields
                }));

                // Organize hierarchically
                examData.questionData = organizeHierarchically(questions);
            }

            return res.status(200).json({
                success: true,
                data: examData
            });
        }

        // POST /api/exams - Create new exam
        if (url === '/api/exams' && method === 'POST') {
            const examData = req.body;

            // Handle question IDs field
            if (examData.questionIds && !examData.Questions) {
                examData.Questions = examData.questionIds;
            }

            const validFields = ['Exam Code', 'Title', 'Duration (mins)', 'Expiry (IST)', 'Questions'];
            const cleanedData = {};
            
            for (const key of Object.keys(examData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = examData[key];
                }
            }

            const record = await base(EXAMS_TABLE).create(cleanedData);
            return res.status(201).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // =====================================================
        // RESULTS ENDPOINTS (with hierarchical scoring)
        // =====================================================

        // POST /api/results - Submit exam results (handles hierarchical scoring)
        if (url === '/api/results' && method === 'POST') {
            const resultData = req.body;

            // Calculate score (handles parent-child questions)
            let totalScore = 0;
            
            if (resultData.answers) {
                const answers = JSON.parse(resultData.answers);
                
                // Get all questions for this exam
                const examRecords = await base(EXAMS_TABLE).select({
                    filterByFormula: `{Exam Code} = '${sanitizeForFormula(resultData.examCode)}'`
                }).all();

                if (examRecords.length > 0) {
                    const exam = examRecords[0];
                    
                    if (exam.fields.Questions) {
                        const questionRecords = await Promise.all(
                            exam.fields.Questions.map(qId => base(QUESTIONS_TABLE).find(qId))
                        );

                        questionRecords.forEach(qRecord => {
                            const q = qRecord.fields;
                            const questionType = q['Question Type'];
                            const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
                            
                            // Only score actual questions with options
                            // Standalone questions OR child questions in parent-child relationship
                            const shouldScore = questionType === QUESTION_TYPES.STANDALONE || 
                                              (questionType === QUESTION_TYPES.PARENT_CHILD && hasParentLink);
                            
                            if (shouldScore) {
                                const userAnswer = answers[q.ID];
                                const correctAnswer = q.Correct || q['Correct Answer'];

                                if (userAnswer === correctAnswer) {
                                    totalScore += 1; // +1 for correct
                                } else if (userAnswer && userAnswer !== 'unanswered') {
                                    totalScore -= 0.25; // -0.25 for incorrect
                                }
                                // 0 for unanswered
                            }
                        });
                    }
                }
            }

            // Create result record
            // Build fields object - handle Timestamp field type variations
            const now = new Date();
            const resultFields = {
                'Exam': resultData.examId ? [resultData.examId] : undefined,
                'Name': resultData.name,
                'Mobile': resultData.mobile,
                'Score': totalScore,
                'Answers': resultData.answers
            };

            // Try creating with DateTime format first, fall back to Date only if it fails
            let record;
            try {
                resultFields['Timestamp'] = now.toISOString();
                record = await base(RESULTS_TABLE).create(resultFields);
            } catch (timestampError) {
                // If Timestamp field rejects ISO format, try date-only format
                console.log('Trying date-only format for Timestamp');
                resultFields['Timestamp'] = now.toISOString().split('T')[0];
                record = await base(RESULTS_TABLE).create(resultFields);
            }

            return res.status(201).json({
                success: true,
                data: {
                    id: record.id,
                    score: totalScore,
                    ...record.fields
                }
            });
        }

        // GET /api/results/:examCode - Get all results for an exam
        if (url.startsWith('/api/results/') && method === 'GET') {
            const examCode = url.split('/api/results/')[1];

            if (!examCode) {
                return res.status(400).json({
                    success: false,
                    error: 'Exam code is required'
                });
            }

            try {
                // First, find the exam by code to get its record ID
                const examRecords = await base(EXAMS_TABLE).select({
                    filterByFormula: `{Exam Code} = '${sanitizeForFormula(examCode)}'`
                }).all();

                if (examRecords.length === 0) {
                    return res.status(200).json({
                        success: true,
                        data: [],
                        message: 'No exam found with this code'
                    });
                }

                const examRecordId = examRecords[0].id;

                // Get all results linked to this exam
                const resultRecords = await base(RESULTS_TABLE).select({
                    filterByFormula: `FIND('${examRecordId}', ARRAYJOIN({Exam}, ',')) > 0`
                }).all();

                const results = resultRecords.map(record => ({
                    id: record.id,
                    ...record.fields,
                    examCode: examCode
                }));

                // Sort by timestamp descending (newest first)
                results.sort((a, b) => {
                    const dateA = new Date(a.Timestamp || 0);
                    const dateB = new Date(b.Timestamp || 0);
                    return dateB - dateA;
                });

                return res.status(200).json({
                    success: true,
                    data: results,
                    count: results.length
                });
            } catch (error) {
                console.error('Error fetching results:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to fetch results'
                });
            }
        }

        // =====================================================
        // AUTHENTICATION ENDPOINTS
        // =====================================================

        // POST /api/auth/admin/login - Admin login
        if (url === '/api/auth/admin/login' && method === 'POST') {
            const { username, password } = req.body;

            // Admin authentication - use environment variables or hardcoded default
            const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'politeadmin';

            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                return res.status(200).json({
                    success: true,
                    data: {
                        role: 'admin',
                        username: username,
                        token: 'admin_' + Date.now()
                    },
                    message: 'Login successful'
                });
            } else {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }
        }

        // POST /api/auth/student/login - Student login
        if (url === '/api/auth/student/login' && method === 'POST') {
            const { mobile } = req.body;

            if (!mobile || mobile.length !== 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid mobile number (must be 10 digits)'
                });
            }

            // Validate student exists in database (optional - can add later)
            // For now, accept any 10-digit mobile number
            return res.status(200).json({
                success: true,
                data: {
                    role: 'student',
                    mobile: mobile,
                    token: 'student_' + Date.now()
                },
                message: 'Login successful'
            });
        }

        // POST /api/auth/reset-password - Reset password (email-based)
        if (url === '/api/auth/reset-password' && method === 'POST') {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            try {
                // Find student by email
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No account found with this email address'
                    });
                }

                // Generate temporary password
                const tempPassword = generateTempPassword();
                const hashedPassword = hashPassword(tempPassword);

                // Update student's password
                await base(STUDENTS_TABLE).update(records[0].id, {
                    'Password': hashedPassword
                });

                return res.status(200).json({
                    success: true,
                    data: {
                        tempPassword: tempPassword
                    },
                    message: 'Password reset successful. Use the temporary password to login.'
                });
            } catch (error) {
                console.error('Password reset error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to reset password'
                });
            }
        }

        // =====================================================
        // CANDIDATE AUTHENTICATION ENDPOINTS (Email-based)
        // =====================================================

        // POST /api/auth/candidate/signup - Candidate registration
        if (url === '/api/auth/candidate/signup' && method === 'POST') {
            const { name, email, mobile, password } = req.body;

            // Validation
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, email, and password are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format'
                });
            }

            // Validate password strength
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters'
                });
            }

            try {
                // Check if email already exists
                const existingRecords = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (existingRecords.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: 'An account with this email already exists'
                    });
                }

                // Hash the password
                const hashedPassword = hashPassword(password);

                // Create new student record
                const record = await base(STUDENTS_TABLE).create({
                    'Name': name,
                    'Email': email,
                    'Mobile': mobile || '',
                    'Password': hashedPassword,
                    'Verified': true, // Auto-verify for simplicity (can add email verification later)
                    'Created At': new Date().toISOString()
                });

                return res.status(201).json({
                    success: true,
                    data: {
                        id: record.id,
                        name: name,
                        email: email,
                        mobile: mobile || ''
                    },
                    message: 'Account created successfully'
                });
            } catch (error) {
                console.error('Signup error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create account. Please try again.'
                });
            }
        }

        // POST /api/auth/candidate/login - Candidate login with email/password
        if (url === '/api/auth/candidate/login' && method === 'POST') {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            try {
                // Find student by email
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid email or password'
                    });
                }

                const student = records[0];
                const storedPassword = student.fields.Password;

                // Verify password
                if (!verifyPassword(password, storedPassword)) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid email or password'
                    });
                }

                // Check if account is verified
                if (student.fields.Verified === false) {
                    return res.status(403).json({
                        success: false,
                        error: 'Please verify your email before logging in',
                        requiresVerification: true
                    });
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        id: student.id,
                        name: student.fields.Name,
                        email: student.fields.Email,
                        mobile: student.fields.Mobile || '',
                        profileImage: student.fields['Profile Image'] || '',
                        token: 'candidate_' + Date.now()
                    },
                    message: 'Login successful'
                });
            } catch (error) {
                console.error('Login error:', error);
                console.error('Login error details:', {
                    message: error.message,
                    statusCode: error.statusCode,
                    error: error.error
                });
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Login failed. Please try again.',
                    details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
                });
            }
        }

        // =====================================================
        // CANDIDATE PROFILE ENDPOINTS
        // =====================================================

        // GET /api/candidates/profile/:email - Get candidate profile
        if (url.startsWith('/api/candidates/profile/') && method === 'GET') {
            const email = decodeURIComponent(url.split('/api/candidates/profile/')[1]);

            try {
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Profile not found'
                    });
                }

                const student = records[0];
                return res.status(200).json({
                    success: true,
                    data: {
                        id: student.id,
                        name: student.fields.Name,
                        email: student.fields.Email,
                        mobile: student.fields.Mobile || '',
                        profileImage: student.fields['Profile Image'] || '',
                        createdAt: student.fields['Created At']
                    }
                });
            } catch (error) {
                console.error('Profile fetch error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to load profile'
                });
            }
        }

        // PUT /api/candidates/profile - Update candidate profile
        if (url === '/api/candidates/profile' && method === 'PUT') {
            const { email, name, mobile, profileImage } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required to update profile'
                });
            }

            try {
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Profile not found'
                    });
                }

                const updateData = {};
                if (name) updateData['Name'] = name;
                if (mobile !== undefined) updateData['Mobile'] = mobile;
                if (profileImage !== undefined) updateData['Profile Image'] = profileImage;

                const updatedRecord = await base(STUDENTS_TABLE).update(records[0].id, updateData);

                return res.status(200).json({
                    success: true,
                    data: {
                        id: updatedRecord.id,
                        name: updatedRecord.fields.Name,
                        email: updatedRecord.fields.Email,
                        mobile: updatedRecord.fields.Mobile || '',
                        profileImage: updatedRecord.fields['Profile Image'] || ''
                    },
                    message: 'Profile updated successfully'
                });
            } catch (error) {
                console.error('Profile update error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update profile'
                });
            }
        }

        // GET /api/candidates/exams/:email - Get candidate exam history
        if (url.startsWith('/api/candidates/exams/') && method === 'GET') {
            const email = decodeURIComponent(url.split('/api/candidates/exams/')[1]);

            try {
                // First get the student to get their mobile number (results are linked by mobile)
                const studentRecords = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (studentRecords.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Student not found'
                    });
                }

                const student = studentRecords[0];
                const mobile = student.fields.Mobile;
                const studentName = student.fields.Name;

                // Find results by mobile number OR name (for backwards compatibility)
                let filterFormula = '';
                if (mobile) {
                    filterFormula = `OR({Mobile} = '${sanitizeForFormula(mobile)}', {Name} = '${sanitizeForFormula(studentName)}')`;
                } else {
                    filterFormula = `{Name} = '${sanitizeForFormula(studentName)}'`;
                }

                const resultRecords = await base(RESULTS_TABLE).select({
                    filterByFormula: filterFormula,
                    sort: [{ field: 'Timestamp', direction: 'desc' }]
                }).all();

                const examHistory = resultRecords.map(record => ({
                    id: record.id,
                    examCode: record.fields['Exam Code'] || 'Unknown',
                    examTitle: record.fields['Exam Title'] || record.fields['Exam Code'] || 'Exam',
                    score: record.fields.Score || 0,
                    timestamp: record.fields.Timestamp,
                    answers: record.fields.Answers
                }));

                // Calculate stats
                const totalExams = examHistory.length;
                const totalScore = examHistory.reduce((sum, exam) => sum + (exam.score || 0), 0);
                const averageScore = totalExams > 0 ? (totalScore / totalExams).toFixed(2) : 0;

                return res.status(200).json({
                    success: true,
                    data: {
                        examsGiven: totalExams,
                        averageScore: parseFloat(averageScore),
                        examHistory: examHistory
                    }
                });
            } catch (error) {
                console.error('Exam history fetch error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to load exam history'
                });
            }
        }

        // POST /api/auth/change-password - Change password
        if (url === '/api/auth/change-password' && method === 'POST') {
            const { email, currentPassword, newPassword } = req.body;

            if (!email || !currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, current password, and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters'
                });
            }

            try {
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Account not found'
                    });
                }

                const student = records[0];

                // Verify current password
                if (!verifyPassword(currentPassword, student.fields.Password)) {
                    return res.status(401).json({
                        success: false,
                        error: 'Current password is incorrect'
                    });
                }

                // Update password
                await base(STUDENTS_TABLE).update(student.id, {
                    'Password': hashPassword(newPassword)
                });

                return res.status(200).json({
                    success: true,
                    message: 'Password changed successfully'
                });
            } catch (error) {
                console.error('Password change error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to change password'
                });
            }
        }

        // POST /api/auth/resend-verification - Resend verification email (stub)
        if (url === '/api/auth/resend-verification' && method === 'POST') {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            // For now, just return success (email verification is auto-enabled)
            return res.status(200).json({
                success: true,
                message: 'Verification email sent. Please check your inbox.'
            });
        }

        // GET /api/auth/verify/:token - Verify email (stub)
        if (url.startsWith('/api/auth/verify/') && method === 'GET') {
            // For now, just return success (email verification is auto-enabled)
            return res.status(200).json({
                success: true,
                message: 'Email verified successfully'
            });
        }

        // =====================================================
        // GEMINI AI ENDPOINTS
        // =====================================================

        // POST /api/gemini/extract-questions - Extract questions from image using Gemini Vision
        if (url === '/api/gemini/extract-questions' && method === 'POST') {
            try {
                const { imageData } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                if (!imageData) {
                    return res.status(400).json({
                        success: false,
                        error: 'Image data is required'
                    });
                }

                // Call Gemini Vision API
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    {
                                        text: `You are an expert question extraction system for Indian competitive exams.
Extract ALL questions from this image and AUTOMATICALLY DETECT if they are STANDALONE or PARENT-CHILD questions.

CRITICAL: DETECT QUESTION STRUCTURE
================================
PARENT-CHILD QUESTIONS (Grouped):
- Look for PASSAGES, COMPREHENSIONS, DIRECTIONS, DATA TABLES, CHARTS, PUZZLES, or SCENARIOS followed by multiple questions
- Indicators: "Directions (Q.1-5):", "Read the following passage and answer...", "Based on the following data...", "Study the arrangement and answer..."
- The parent/passage has NO answer options - it's just context/reference text
- Each child question references the parent and HAS answer options (A, B, C, D)

STANDALONE QUESTIONS (Independent):
- Single questions with their own context
- Has all 4 options (A, B, C, D) and a correct answer
- Does not depend on any passage or external context

QUESTION TYPES IN OUTPUT:
- "Parent-child" with subtype "parent" - Reference passage/scenario (no options)
- "Parent-child" with subtype "child" - Sub-questions with options (linked to parent)
- "Standalone" - Regular independent questions with options

Return the data in this EXACT JSON format:
{
  "questions": [
    {
      "question": "Question or passage text (full text)",
      "optionA": "Option A (empty string for parent passages)",
      "optionB": "Option B (empty string for parent passages)",
      "optionC": "Option C (empty string for parent passages)",
      "optionD": "Option D (empty string for parent passages)",
      "correct": "A/B/C/D (empty string for parent passages)",
      "subject": "Subject category",
      "questionType": "Standalone or Parent-child",
      "subType": "parent/child/null",
      "groupId": "group_1, group_2, etc. (for grouping parent with its children)",
      "subQuestionNumber": 1, 2, 3... (order within group, null for standalone/parent)
    }
  ]
}

SUBJECT CATEGORIES: Quantitative Aptitude, Reasoning Ability, English Language, General Awareness, Current Affairs, History, Geography, Economics, Mathematics, Law, Polity, Science, Banking Awareness, Computer Knowledge, Data Interpretation, Logical Reasoning, Others

IMPORTANT RULES:
1. Parent questions (passages) MUST have empty optionA, optionB, optionC, optionD, and correct
2. Child questions MUST have all 4 options and a correct answer
3. All questions in a group MUST share the same groupId
4. Standalone questions have subType: null and groupId: null
5. Extract EVERY question visible in the image
6. Be accurate with the correct answer detection

Return ONLY valid JSON with no extra text.`
                                    },
                                    {
                                        inline_data: {
                                            mime_type: imageData.mimeType || 'image/jpeg',
                                            data: imageData.base64.split(',')[1] || imageData.base64
                                        }
                                    }
                                ]
                            }]
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini API request failed');
                }

                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in response');
                }

                const extractedData = JSON.parse(jsonMatch[0]);

                return res.status(200).json({
                    success: true,
                    data: extractedData
                });

            } catch (error) {
                console.error('Gemini extraction error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to extract questions'
                });
            }
        }

        // POST /api/gemini/generate-question - Generate a question using Gemini AI
        if (url === '/api/gemini/generate-question' && method === 'POST') {
            try {
                const { subject, difficulty, customPrompt, previousQuestions } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                const difficultyText = difficulty || 'medium';
                const subjectName = subject || 'General Knowledge';

                // Generate random seed for uniqueness
                const randomSeed = Math.random().toString(36).substring(2, 15);
                const timestamp = Date.now();
                const randomTopicIndex = Math.floor(Math.random() * 100);

                // Topic variations for each subject to ensure diversity
                const topicVariations = {
                    'Quantitative Aptitude': ['Profit & Loss', 'Simple Interest', 'Compound Interest', 'Percentage', 'Ratio & Proportion', 'Time & Work', 'Time & Distance', 'Average', 'Number System', 'Algebra', 'Geometry', 'Mensuration', 'Data Interpretation', 'Simplification', 'Boat & Stream', 'Pipe & Cistern', 'Age Problems', 'Mixture & Alligation', 'Probability', 'Permutation & Combination'],
                    'Reasoning Ability': ['Blood Relations', 'Coding-Decoding', 'Direction Sense', 'Seating Arrangement', 'Puzzles', 'Syllogism', 'Inequality', 'Input-Output', 'Ranking', 'Alphabetical Series', 'Number Series', 'Analogy', 'Classification', 'Statement & Assumption', 'Statement & Conclusion', 'Critical Reasoning', 'Data Sufficiency', 'Machine Input', 'Floor-based Puzzle', 'Scheduling Puzzle'],
                    'English Language': ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Fill in the Blanks', 'Idioms & Phrases', 'Synonyms', 'Antonyms', 'One Word Substitution', 'Sentence Completion', 'Vocabulary', 'Grammar Rules', 'Active-Passive Voice', 'Direct-Indirect Speech', 'Word Usage', 'Phrase Replacement', 'Column-based Match', 'Word Swap', 'Sentence Connector'],
                    'General Awareness': ['Indian History', 'World History', 'Indian Geography', 'World Geography', 'Indian Polity', 'Economics', 'Science & Technology', 'Environment', 'Sports', 'Awards & Honors', 'Books & Authors', 'Important Days', 'National Parks', 'Rivers & Dams', 'Constitutional Bodies', 'International Organizations', 'Space Missions', 'Defence', 'Government Schemes', 'Art & Culture'],
                    'Current Affairs': ['Banking News', 'Economy Updates', 'Government Policies', 'International Relations', 'Sports Events', 'Science Discoveries', 'Awards 2024', 'Appointments', 'Summits & Conferences', 'MoU & Agreements', 'Stock Market', 'RBI Updates', 'Budget Highlights', 'New Schemes', 'Infrastructure Projects', 'Technology Updates', 'Environmental News', 'Health Updates', 'Educational Reforms', 'Legal Changes'],
                    'History': ['Ancient India', 'Medieval India', 'Modern India', 'Freedom Movement', 'World History', 'Important Battles', 'Dynasties', 'Historical Events', 'Independence Movement', 'Social Reforms', 'Cultural History', 'Economic History', 'Political Movements', 'Mughal Period', 'British India', 'Post-Independence', 'Ancient Civilizations', 'World Wars', 'Important Treaties', 'Historical Personalities'],
                    'Geography': ['Physical Geography', 'Indian Geography', 'World Geography', 'Rivers & Lakes', 'Mountains', 'Climate', 'Agriculture', 'Industries', 'Population', 'Natural Resources', 'Minerals', 'Soils', 'Forests', 'Ocean Currents', 'Monsoons', 'Map Reading', 'GIS & Remote Sensing', 'Environmental Geography', 'Urban Geography', 'Transport'],
                    'Economics': ['Microeconomics', 'Macroeconomics', 'Indian Economy', 'Economic Planning', 'Budget', 'Banking', 'Inflation', 'GDP', 'Fiscal Policy', 'Monetary Policy', 'International Trade', 'Economic Organizations', 'Poverty', 'Unemployment', 'Agriculture Economy', 'Industrial Economy', 'Economic Reforms', 'Five Year Plans', 'Public Finance', 'Development Economics'],
                    'Mathematics': ['Arithmetic', 'Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Probability', 'Number Theory', 'Calculus', 'Mensuration', 'Coordinate Geometry', 'Linear Equations', 'Quadratic Equations', 'Sets', 'Functions', 'Matrices', 'Determinants', 'Sequences & Series', 'Progressions', 'Logarithms', 'Surds'],
                    'Law': ['Constitutional Law', 'Criminal Law', 'Civil Law', 'Contract Law', 'Property Law', 'Family Law', 'Labour Law', 'Environmental Law', 'International Law', 'Human Rights', 'Fundamental Rights', 'Directive Principles', 'Writs', 'Judiciary', 'Legal Maxims', 'IPC', 'CrPC', 'CPC', 'Evidence Act', 'Legal Reasoning'],
                    'Polity': ['Indian Constitution', 'Parliament', 'President', 'Prime Minister', 'Supreme Court', 'High Courts', 'Fundamental Rights', 'Directive Principles', 'Constitutional Bodies', 'Emergency Provisions', 'Union & States', 'Local Government', 'Election Commission', 'CAG', 'UPSC', 'Finance Commission', 'Amendment Procedures', 'Schedules', 'Articles', 'Citizenship'],
                    'Science': ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Environmental Science', 'Scientific Inventions', 'Scientists', 'Human Body', 'Diseases', 'Nutrition', 'Space Science', 'Nuclear Science', 'Biotechnology', 'Nanotechnology', 'Computer Science', 'Artificial Intelligence', 'Renewable Energy', 'Pollution', 'Conservation', 'Latest Discoveries'],
                    'Banking Awareness': ['RBI Functions', 'Banking Terms', 'Types of Banks', 'Monetary Policy', 'Financial Inclusion', 'NPA Management', 'Banking Regulations', 'Credit Cards', 'Loan Types', 'Insurance', 'NABARD', 'SIDBI', 'Digital Banking', 'UPI & BHIM', 'Core Banking', 'KYC Norms', 'Basel Norms', 'Banking History', 'Foreign Exchange', 'SEBI Guidelines'],
                    'Computer Knowledge': ['Computer Fundamentals', 'Operating Systems', 'MS Office', 'Networking', 'Internet', 'Database', 'Programming Basics', 'Computer Security', 'Hardware', 'Software', 'Computer Memory', 'Input-Output Devices', 'Computer Generations', 'Number Systems', 'Data Communication', 'Cloud Computing', 'Cyber Security', 'Web Technologies', 'Mobile Computing', 'Emerging Technologies']
                };

                // Get a random topic for the subject
                const topics = topicVariations[subjectName] || topicVariations['General Awareness'];
                const randomTopic = topics[Math.floor(Math.random() * topics.length)];
                const anotherRandomTopic = topics[Math.floor(Math.random() * topics.length)];

                let prompt = '';
                if (customPrompt && customPrompt.trim()) {
                    prompt = `Generate a COMPLETELY NEW and UNIQUE multiple choice question based on: "${customPrompt}"
The question should be suitable for Indian competitive exams. Make it ${difficultyText} difficulty level.
Focus on a DIFFERENT aspect than typical questions. Be creative and original.`;
                } else {
                    prompt = `Generate a COMPLETELY NEW and UNIQUE ${difficultyText} difficulty multiple choice question for ${subjectName}.
IMPORTANT: Focus specifically on the topic "${randomTopic}" or "${anotherRandomTopic}".
Make it suitable for Indian competitive exams like Railway RRB, Bank PO/Clerk, SSC, UPSC.
Be creative - do NOT generate a common or frequently asked question.`;
                }

                // Add previous questions to avoid if provided
                let avoidText = '';
                if (previousQuestions && previousQuestions.length > 0) {
                    avoidText = `

IMPORTANT: DO NOT generate questions similar to these recently generated questions:
${previousQuestions.slice(0, 5).map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate something COMPLETELY DIFFERENT from the above.`;
                }

                prompt += `${avoidText}

Random seed for uniqueness: ${randomSeed}-${timestamp}-${randomTopicIndex}

Return ONLY valid JSON in this EXACT format:
{
  "question": "The complete question text - make it unique and interesting",
  "optionA": "First option",
  "optionB": "Second option",
  "optionC": "Third option",
  "optionD": "Fourth option",
  "correct": "A or B or C or D",
  "explanation": "Brief explanation of the correct answer",
  "subject": "${subjectName}",
  "difficulty": "${difficultyText}",
  "topic": "Specific topic this question covers"
}

Generate a FRESH, UNIQUE, CREATIVE question that hasn't been asked before. Ensure one clearly correct answer. Think outside the box!`;

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }],
                            generationConfig: {
                                temperature: 0.9,
                                topK: 40,
                                topP: 0.95,
                                maxOutputTokens: 1024
                            }
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini API request failed');
                }

                let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
                text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

                // Extract JSON object - find the outermost balanced braces
                let jsonStr = '';
                let braceCount = 0;
                let inJson = false;
                for (let i = 0; i < text.length; i++) {
                    if (text[i] === '{') {
                        if (!inJson) inJson = true;
                        braceCount++;
                    }
                    if (inJson) {
                        jsonStr += text[i];
                    }
                    if (text[i] === '}') {
                        braceCount--;
                        if (braceCount === 0 && inJson) break;
                    }
                }

                if (!jsonStr || jsonStr.length < 10) {
                    console.error('Raw Gemini response:', text);
                    throw new Error('No valid JSON found in response. Raw text: ' + text.substring(0, 200));
                }

                let questionData;
                try {
                    questionData = JSON.parse(jsonStr);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError, 'Text:', jsonStr);
                    // Try to fix common JSON issues
                    let fixedJson = jsonStr
                        .replace(/,\s*}/g, '}')  // Remove trailing commas
                        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                        .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
                        .replace(/\n/g, ' ')  // Replace newlines with spaces
                        .replace(/\r/g, ''); // Remove carriage returns
                    questionData = JSON.parse(fixedJson);
                }

                return res.status(200).json({
                    success: true,
                    data: questionData
                });

            } catch (error) {
                console.error('Gemini generation error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to generate question'
                });
            }
        }

        // =====================================================
        // ADMIN ENDPOINTS - Airtable Schema Configuration
        // =====================================================

        // POST /api/admin/setup-question-types - Configure Question Type field in Airtable
        if (url === '/api/admin/setup-question-types' && method === 'POST') {
            try {
                const baseId = process.env.AIRTABLE_BASE_ID;
                const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

                if (!baseId || !token) {
                    return res.status(400).json({
                        success: false,
                        error: 'Airtable credentials not configured'
                    });
                }

                // Step 1: Get the table schema to find the Question Type field
                const schemaResponse = await fetch(
                    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!schemaResponse.ok) {
                    const errorData = await schemaResponse.json();
                    // If schema API is not accessible, provide manual instructions
                    if (schemaResponse.status === 403 || schemaResponse.status === 401) {
                        return res.status(200).json({
                            success: false,
                            needsManualSetup: true,
                            instructions: [
                                '1. Open your Airtable base',
                                '2. Go to the Questions table',
                                '3. Find or create a field called "Question Type"',
                                '4. Set field type to "Single select"',
                                '5. Add these options: "Standalone", "Parent-child"',
                                '6. Save the changes'
                            ],
                            error: 'Schema API access denied. Please configure manually.'
                        });
                    }
                    throw new Error(errorData.error?.message || 'Failed to fetch schema');
                }

                const schemaData = await schemaResponse.json();
                const questionsTable = schemaData.tables.find(t => t.name === QUESTIONS_TABLE);

                if (!questionsTable) {
                    return res.status(404).json({
                        success: false,
                        error: `Table "${QUESTIONS_TABLE}" not found in Airtable base`
                    });
                }

                // Find the Question Type field
                let questionTypeField = questionsTable.fields.find(f => f.name === 'Question Type');

                if (!questionTypeField) {
                    // Field doesn't exist - create it
                    console.log('Creating Question Type field...');
                    const createFieldResponse = await fetch(
                        `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${questionsTable.id}/fields`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name: 'Question Type',
                                type: 'singleSelect',
                                options: {
                                    choices: [
                                        { name: 'Standalone', color: 'blueLight2' },
                                        { name: 'Parent-child', color: 'purpleLight2' }
                                    ]
                                }
                            })
                        }
                    );

                    if (!createFieldResponse.ok) {
                        const createError = await createFieldResponse.json();
                        throw new Error(createError.error?.message || 'Failed to create Question Type field');
                    }

                    const createdField = await createFieldResponse.json();
                    return res.status(201).json({
                        success: true,
                        message: 'Question Type field created successfully!',
                        field: createdField
                    });
                }

                // Field exists - check if it has the right options
                const existingChoices = questionTypeField.options?.choices || [];
                const existingNames = existingChoices.map(c => c.name);
                const requiredOptions = ['Standalone', 'Parent-child'];
                const missingOptions = requiredOptions.filter(opt => !existingNames.includes(opt));

                if (missingOptions.length === 0) {
                    return res.status(200).json({
                        success: true,
                        message: 'Question Type field is already configured correctly!',
                        existingOptions: existingNames
                    });
                }

                // Update field to add missing options
                console.log('Updating Question Type field with missing options:', missingOptions);
                const newChoices = [
                    ...existingChoices,
                    ...missingOptions.map(name => ({
                        name,
                        color: name === 'Standalone' ? 'blueLight2' : 'purpleLight2'
                    }))
                ];

                const updateFieldResponse = await fetch(
                    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${questionsTable.id}/fields/${questionTypeField.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            options: {
                                choices: newChoices
                            }
                        })
                    }
                );

                if (!updateFieldResponse.ok) {
                    const updateError = await updateFieldResponse.json();
                    throw new Error(updateError.error?.message || 'Failed to update Question Type field');
                }

                const updatedField = await updateFieldResponse.json();
                return res.status(200).json({
                    success: true,
                    message: `Added missing options: ${missingOptions.join(', ')}`,
                    field: updatedField
                });

            } catch (error) {
                console.error('Setup error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to setup Question Type field',
                    instructions: [
                        '1. Open your Airtable base',
                        '2. Go to the Questions table',
                        '3. Find or create a field called "Question Type"',
                        '4. Set field type to "Single select"',
                        '5. Add these options: "Standalone", "Parent-child"',
                        '6. Save the changes'
                    ]
                });
            }
        }

        // GET /api/admin/check-schema - Check if Airtable schema is properly configured
        if (url === '/api/admin/check-schema' && method === 'GET') {
            try {
                const baseId = process.env.AIRTABLE_BASE_ID;
                const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

                const schemaResponse = await fetch(
                    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!schemaResponse.ok) {
                    return res.status(200).json({
                        success: true,
                        schemaAccess: false,
                        message: 'Cannot access schema API - manual configuration required'
                    });
                }

                const schemaData = await schemaResponse.json();
                const questionsTable = schemaData.tables.find(t => t.name === QUESTIONS_TABLE);
                const questionTypeField = questionsTable?.fields.find(f => f.name === 'Question Type');
                const choices = questionTypeField?.options?.choices || [];

                return res.status(200).json({
                    success: true,
                    schemaAccess: true,
                    questionTypeField: {
                        exists: !!questionTypeField,
                        type: questionTypeField?.type,
                        options: choices.map(c => c.name)
                    },
                    isConfigured: choices.some(c => c.name === 'Standalone') && choices.some(c => c.name === 'Parent-child')
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        // =====================================================
        // DEFAULT - 404
        // =====================================================
        return res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
