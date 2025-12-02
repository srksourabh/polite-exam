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
const STUDENTS_TABLE = 'Students';

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

            const record = await base(QUESTIONS_TABLE).create(cleanedData);
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

            const record = await base(QUESTIONS_TABLE).update(questionId, cleanedData);
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
            for (let i = 0; i < cleanedQuestions.length; i += 10) {
                const batch = cleanedQuestions.slice(i, i + 10);
                const records = await base(QUESTIONS_TABLE).create(batch);
                results.push(...records);
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
            const record = await base(RESULTS_TABLE).create({
                'Timestamp': new Date().toISOString(),
                'Exam': resultData.examId ? [resultData.examId] : undefined,
                'Name': resultData.name,
                'Mobile': resultData.mobile,
                'Score': totalScore,
                'Answers': resultData.answers
            });

            return res.status(201).json({
                success: true,
                data: {
                    id: record.id,
                    score: totalScore,
                    ...record.fields
                }
            });
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
                return res.status(500).json({
                    success: false,
                    error: 'Login failed. Please try again.'
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
Extract ALL questions from this image and AUTOMATICALLY DETECT HIERARCHICAL/GROUPED QUESTIONS.

HIERARCHICAL QUESTION DETECTION:
- Look for PASSAGES, COMPREHENSIONS, DIRECTIONS, or DATA/CHARTS followed by multiple questions
- Examples: "Directions (Q.1-5):", "Read the following passage...", etc.

QUESTION TYPES TO IDENTIFY:
1. "passage" - Reference text with NO answer options (parent of sub-questions)
2. "sub-question" - Questions that refer to a passage above (have options)
3. "standalone" - Regular independent questions (have options)

Return the data in this EXACT JSON format:
{
  "questions": [
    {
      "question": "Question or passage text",
      "optionA": "Option A (empty for passages)",
      "optionB": "Option B",
      "optionC": "Option C",
      "optionD": "Option D",
      "correct": "A/B/C/D (empty for passages)",
      "subject": "Subject category",
      "questionType": "passage/sub-question/standalone",
      "parentId": "passage_N or null",
      "subQuestionOrder": 1 or null
    }
  ]
}

SUBJECT CATEGORIES: Quantitative Aptitude, Reasoning Ability, English Language, General Awareness, Current Affairs, Banking Awareness, Computer Knowledge, Data Interpretation

Extract ALL questions. Return ONLY valid JSON.`
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
                const { subject, difficulty, customPrompt } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                const difficultyText = difficulty || 'medium';
                const subjectName = subject || 'General Knowledge';

                let prompt = '';
                if (customPrompt && customPrompt.trim()) {
                    prompt = `Generate a unique multiple choice question based on: "${customPrompt}"
The question should be suitable for Indian competitive exams. Make it ${difficultyText} difficulty level.`;
                } else {
                    prompt = `Generate a UNIQUE ${difficultyText} difficulty multiple choice question for ${subjectName}.
Make it suitable for Indian competitive exams like Railway RRB, Bank PO/Clerk, SSC, UPSC.`;
                }

                prompt += `

Return ONLY valid JSON in this EXACT format:
{
  "question": "The complete question text",
  "optionA": "First option",
  "optionB": "Second option",
  "optionC": "Third option",
  "optionD": "Fourth option",
  "correct": "A or B or C or D",
  "explanation": "Brief explanation of the correct answer",
  "subject": "${subjectName}",
  "difficulty": "${difficultyText}"
}

Generate a fresh, unique question. Ensure one clearly correct answer.`;

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

                const questionData = JSON.parse(jsonMatch[0]);

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
