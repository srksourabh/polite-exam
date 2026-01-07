const Airtable = require('airtable');
const crypto = require('crypto');
const { Resend } = require('resend');

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
// RESEND EMAIL CONFIGURATION
// =====================================================
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'https://polite-exam.vercel.app';

// Initialize Resend if API key is available
let resend = null;
if (RESEND_API_KEY) {
    resend = new Resend(RESEND_API_KEY);
    console.log('✅ Resend initialized');
} else {
    console.warn('⚠️ RESEND_API_KEY not set - email verification disabled');
}

// Generate a verification token (6-digit code for simplicity)
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store last email error for debugging
let lastEmailError = null;

// Send verification email
async function sendVerificationEmail(email, name, verificationCode) {
    if (!resend) {
        console.warn('Resend not configured - skipping email');
        lastEmailError = 'Resend not configured';
        return false;
    }

    try {
        // Use Resend's test sender for free tier (or verified domain sender)
        const fromAddress = EMAIL_FROM.includes('@')
            ? `Polite Exam <${EMAIL_FROM}>`
            : 'Polite Exam <onboarding@resend.dev>';

        console.log('📧 Sending email from:', fromAddress, 'to:', email);

        const { data, error } = await resend.emails.send({
            from: fromAddress,
            to: email,
            subject: 'Verify your Polite Exam account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5;">Welcome to Polite Exam!</h2>
                    <p>Hi ${name},</p>
                    <p>Thank you for signing up. Please verify your email address using the code below:</p>
                    <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5;">${verificationCode}</span>
                    </div>
                    <p>This code will expire in 24 hours.</p>
                    <p>If you didn't create an account, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">Polite Exam - Online Examination Platform</p>
                </div>
            `
        });

        if (error) {
            console.error('❌ Resend error:', JSON.stringify(error));
            lastEmailError = error.message || JSON.stringify(error);
            return false;
        }

        console.log('✅ Verification email sent to:', email, 'ID:', data?.id);
        lastEmailError = null;
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        lastEmailError = error.message;
        return false;
    }
}

// Get last email error (for debugging)
function getLastEmailError() {
    return lastEmailError;
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

            // Use the score calculated by frontend (more reliable since frontend has direct access to user answers)
            // Frontend sends Score with correct calculation: +1 correct, -0.25 wrong, 0 unanswered
            let totalScore = resultData.Score || resultData.score || 0;
            let examRecord = null;
            let examCode = resultData.examCode || '';
            let examTitle = resultData.examTitle || '';

            // Get exam record for linking (don't recalculate score - use frontend value)
            if (resultData.examCode) {
                const examRecords = await base(EXAMS_TABLE).select({
                    filterByFormula: `{Exam Code} = '${sanitizeForFormula(resultData.examCode)}'`
                }).all();

                if (examRecords.length > 0) {
                    examRecord = examRecords[0];
                    examCode = examRecord.fields['Exam Code'] || resultData.examCode;
                    // Use provided title or fall back to record
                    if (!examTitle) {
                        examTitle = examRecord.fields['Exam Title'] || examRecord.fields['Title'] || examCode;
                    }
                }
            }

            // Create result record - use linked Exam field for retrieval
            // Build fields object - handle Timestamp field type variations
            const now = new Date();

            // Build base result fields (only use fields that exist in Airtable)
            // Handle both uppercase and lowercase field names from frontend
            // Ensure Exam link is set if we have an exam record
            const examLink = resultData.examId ? [resultData.examId] : (examRecord ? [examRecord.id] : undefined);

            const resultFields = {
                'Exam': examLink,
                'Exam Code': examCode, // Store exam code as backup for retrieval
                'Name': resultData.Name || resultData.name,
                'Mobile': resultData.Mobile || resultData.mobile,
                'Score': totalScore,
                'Answers': resultData.Answers || resultData.answers
            };

            // Log for debugging
            console.log(`Creating result for exam: ${examCode}, examId: ${resultData.examId}, examRecordId: ${examRecord?.id}, examLink: ${JSON.stringify(examLink)}`);

            // Try creating with different field combinations (handle optional fields gracefully)
            let record;
            const createWithFields = async (fields) => {
                try {
                    return await base(RESULTS_TABLE).create(fields);
                } catch (error) {
                    // If specific field fails, try without it
                    if (error.message && error.message.includes('Unknown field name')) {
                        const fieldMatch = error.message.match(/Unknown field name: "([^"]+)"/);
                        if (fieldMatch) {
                            const badField = fieldMatch[1];
                            console.log(`Field "${badField}" not found, creating without it`);
                            delete fields[badField];
                            return await base(RESULTS_TABLE).create(fields);
                        }
                    }
                    throw error;
                }
            };

            try {
                resultFields['Timestamp'] = now.toISOString();
                record = await createWithFields(resultFields);
            } catch (timestampError) {
                // If Timestamp field rejects ISO format, try date-only format
                console.log('Trying date-only format for Timestamp');
                resultFields['Timestamp'] = now.toISOString().split('T')[0];
                record = await createWithFields(resultFields);
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

                // Get all results - try multiple approaches to handle different Airtable configurations
                let resultRecords = [];

                // Method 1: Try with linked record field 'Exam'
                try {
                    resultRecords = await base(RESULTS_TABLE).select({
                        filterByFormula: `FIND('${examRecordId}', ARRAYJOIN({Exam}, ',')) > 0`
                    }).all();
                } catch (linkedFieldError) {
                    console.log('Linked field query failed, trying alternative methods');
                }

                // Method 2: If no results from linked field, try 'Exam Code' text field
                if (resultRecords.length === 0) {
                    try {
                        const altResults = await base(RESULTS_TABLE).select({
                            filterByFormula: `{Exam Code} = '${sanitizeForFormula(examCode)}'`
                        }).all();
                        if (altResults.length > 0) {
                            resultRecords = altResults;
                        }
                    } catch (textFieldError) {
                        console.log('Exam Code text field not found');
                    }
                }

                // Method 3: If still no results, fetch all and filter client-side
                if (resultRecords.length === 0) {
                    try {
                        const allResults = await base(RESULTS_TABLE).select().all();
                        resultRecords = allResults.filter(record => {
                            const examField = record.fields['Exam'];
                            const examCodeField = record.fields['Exam Code'] || record.fields['examCode'];
                            // Check if linked to this exam or has matching exam code
                            if (Array.isArray(examField) && examField.includes(examRecordId)) {
                                return true;
                            }
                            if (examCodeField === examCode) {
                                return true;
                            }
                            return false;
                        });
                    } catch (fallbackError) {
                        console.log('Fallback query failed:', fallbackError.message);
                    }
                }

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
        // Supports both hardcoded default (admin/politeadmin) and database-backed admins
        if (url === '/api/auth/admin/login' && method === 'POST') {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Username and password are required'
                });
            }

            try {
                // First, check hardcoded default admin credentials
                if (username === 'admin' && password === 'politeadmin') {
                    return res.status(200).json({
                        success: true,
                        data: {
                            role: 'admin',
                            username: 'admin',
                            name: 'Administrator',
                            token: 'admin_' + Date.now()
                        },
                        message: 'Login successful'
                    });
                }

                // If not default admin, check database for admin with Role='admin'
                try {
                    const adminRecords = await base(STUDENTS_TABLE).select({
                        filterByFormula: `AND({Email} = '${sanitizeForFormula(username)}', {Role} = 'admin')`
                    }).all();

                    const admin = adminRecords[0];
                    if (admin && verifyPassword(password, admin.fields.Password)) {
                        return res.status(200).json({
                            success: true,
                            data: {
                                role: 'admin',
                                username: admin.fields.Email,
                                name: admin.fields.Name || 'Administrator',
                                token: 'admin_' + Date.now()
                            },
                            message: 'Login successful'
                        });
                    }
                } catch (dbError) {
                    // Database check failed (possibly Role field doesn't exist), continue to reject
                    console.log('Database admin check skipped:', dbError.message);
                }

                // Invalid credentials
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            } catch (error) {
                console.error('Admin login error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Login failed. Please try again.'
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

                // Generate verification code
                const verificationCode = generateVerificationCode();
                const requiresVerification = !!RESEND_API_KEY;

                // Create new student record
                // Include verification fields if email verification is enabled
                const createFields = {
                    'Name': name,
                    'Email': email,
                    'Mobile': mobile || '',
                    'Password': hashedPassword
                };

                // Add verification fields if SendGrid is configured
                if (requiresVerification) {
                    createFields['Verified'] = false;
                    createFields['Verification Code'] = verificationCode;
                }

                let record;
                try {
                    record = await base(STUDENTS_TABLE).create(createFields);
                } catch (createError) {
                    // If verification fields don't exist, try without them
                    if (createError.message && createError.message.includes('Unknown field')) {
                        console.warn('Verification fields not in Airtable, creating without them');
                        record = await base(STUDENTS_TABLE).create({
                            'Name': name,
                            'Email': email,
                            'Mobile': mobile || '',
                            'Password': hashedPassword
                        });
                    } else {
                        throw createError;
                    }
                }

                // Send verification email if configured
                let emailSent = false;
                if (requiresVerification) {
                    emailSent = await sendVerificationEmail(email, name, verificationCode);
                }

                return res.status(201).json({
                    success: true,
                    data: {
                        id: record.id,
                        name: name,
                        email: email,
                        mobile: mobile || '',
                        requiresVerification: requiresVerification && emailSent,
                        emailSent: emailSent
                    },
                    message: requiresVerification && emailSent
                        ? 'Account created! Please check your email for verification code.'
                        : 'Account created successfully'
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

                // Check email verification status (only if SendGrid is configured)
                if (RESEND_API_KEY && student.fields.Verified === false) {
                    return res.status(403).json({
                        success: false,
                        error: 'Please verify your email before logging in',
                        requiresVerification: true,
                        email: email
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

                // Process results, looking up exam details from linked record if needed
                const examHistory = await Promise.all(resultRecords.map(async (record) => {
                    let examCode = record.fields['Exam Code'];
                    let examTitle = record.fields['Exam Title'];

                    // If no exam code stored, try to get from linked Exam record
                    if (!examCode && record.fields.Exam && record.fields.Exam.length > 0) {
                        try {
                            const linkedExam = await base(EXAMS_TABLE).find(record.fields.Exam[0]);
                            examCode = linkedExam.fields['Exam Code'] || 'Unknown';
                            examTitle = linkedExam.fields['Exam Title'] || linkedExam.fields['Title'] || examCode;
                        } catch (e) {
                            examCode = 'Unknown';
                            examTitle = 'Exam';
                        }
                    }

                    return {
                        id: record.id,
                        examId: record.fields.Exam ? record.fields.Exam[0] : null,
                        examCode: examCode || 'Unknown',
                        examTitle: examTitle || examCode || 'Exam',
                        score: record.fields.Score || 0,
                        timestamp: record.fields.Timestamp,
                        answers: record.fields.Answers
                    };
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

        // POST /api/auth/resend-verification - Resend verification email
        if (url === '/api/auth/resend-verification' && method === 'POST') {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            if (!RESEND_API_KEY) {
                return res.status(200).json({
                    success: true,
                    message: 'Email verification is not configured. You can login directly.'
                });
            }

            try {
                // Find the user
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No account found with this email'
                    });
                }

                const student = records[0];

                // Check if already verified
                if (student.fields.Verified === true) {
                    return res.status(200).json({
                        success: true,
                        message: 'Email is already verified. You can login.'
                    });
                }

                // Generate new verification code
                const newCode = generateVerificationCode();

                // Update the verification code in Airtable
                try {
                    await base(STUDENTS_TABLE).update(student.id, {
                        'Verification Code': newCode
                    });
                } catch (airtableError) {
                    console.error('Airtable update error:', airtableError.message);
                    return res.status(500).json({
                        success: false,
                        error: 'Database error: ' + (airtableError.message || 'Failed to update verification code'),
                        hint: 'Ensure "Verification Code" field exists in Airtable Candidates table'
                    });
                }

                // Check if Resend is configured
                if (!resend) {
                    return res.status(500).json({
                        success: false,
                        error: 'Email service not configured',
                        hint: 'RESEND_API_KEY environment variable not set in Vercel'
                    });
                }

                // Send verification email
                const emailSent = await sendVerificationEmail(email, student.fields.Name, newCode);

                if (emailSent) {
                    return res.status(200).json({
                        success: true,
                        message: 'Verification email sent. Please check your inbox.'
                    });
                } else {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to send email via Resend',
                        details: getLastEmailError(),
                        hint: 'Check Resend API key and sender email configuration'
                    });
                }
            } catch (error) {
                console.error('Resend verification error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to resend verification email'
                });
            }
        }

        // POST /api/auth/verify-email - Verify email with code
        if (url === '/api/auth/verify-email' && method === 'POST') {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and verification code are required'
                });
            }

            try {
                // Find the user
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
                }).all();

                if (records.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No account found with this email'
                    });
                }

                const student = records[0];

                // Check if already verified
                if (student.fields.Verified === true) {
                    return res.status(200).json({
                        success: true,
                        message: 'Email is already verified. You can login.'
                    });
                }

                // Verify the code
                if (student.fields['Verification Code'] !== code) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid verification code'
                    });
                }

                // Mark as verified
                await base(STUDENTS_TABLE).update(student.id, {
                    'Verified': true,
                    'Verification Code': '' // Clear the code
                });

                return res.status(200).json({
                    success: true,
                    message: 'Email verified successfully! You can now login.'
                });
            } catch (error) {
                console.error('Verify email error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to verify email'
                });
            }
        }

        // DELETE /api/admin/cleanup-unverified - Delete unverified accounts (admin only)
        if (url === '/api/admin/cleanup-unverified' && method === 'DELETE') {
            const { adminPassword } = req.body;

            // Simple admin password check
            if (adminPassword !== 'politeadmin') {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            try {
                // Find all unverified accounts
                const records = await base(STUDENTS_TABLE).select({
                    filterByFormula: `{Verified} = FALSE()`
                }).all();

                if (records.length === 0) {
                    return res.status(200).json({
                        success: true,
                        message: 'No unverified accounts found',
                        deleted: 0
                    });
                }

                // Delete each unverified account
                const recordIds = records.map(r => r.id);

                // Airtable allows max 10 records per delete call
                const chunks = [];
                for (let i = 0; i < recordIds.length; i += 10) {
                    chunks.push(recordIds.slice(i, i + 10));
                }

                for (const chunk of chunks) {
                    await base(STUDENTS_TABLE).destroy(chunk);
                }

                console.log(`✅ Deleted ${records.length} unverified accounts`);

                return res.status(200).json({
                    success: true,
                    message: `Deleted ${records.length} unverified account(s)`,
                    deleted: records.length,
                    emails: records.map(r => r.fields.Email)
                });
            } catch (error) {
                console.error('Cleanup error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to cleanup unverified accounts'
                });
            }
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
                                        text: `You are an expert question extraction system for Indian competitive exams (IBPS, SSC, RRB, UPSC, Bank PO/Clerk, etc.).

Extract ALL questions from this image and AUTOMATICALLY DETECT the question structure.

===== CRITICAL: IDENTIFYING PARENT-CHILD vs STANDALONE =====

PARENT-CHILD QUESTIONS (MOST COMMON in competitive exams):
These are questions that share common context/passage/data. Look for these patterns:

1. COMPREHENSION PASSAGES:
   - "Read the following passage and answer questions 1-5"
   - "Directions: Read the passage carefully and answer..."
   - Long text paragraph followed by multiple MCQs

2. DATA INTERPRETATION (DI):
   - "Study the following table/chart/graph and answer..."
   - "The following pie chart/bar graph shows..."
   - Tables, charts, or graphs followed by multiple questions

3. REASONING PUZZLES:
   - "Directions: Study the following arrangement..."
   - "Eight persons A, B, C, D, E, F, G, H are sitting in a row..."
   - Seating arrangements, blood relations, floor puzzles
   - "Based on the following information, answer Q.1-5"

4. CLOZE TEST (English):
   - "Fill in the blanks from the options given..."
   - Paragraph with numbered blanks (1), (2), (3)...
   - Each blank has 4 options

5. SENTENCE REARRANGEMENT:
   - "Rearrange the following sentences..."
   - Multiple related questions about same set of sentences

IDENTIFICATION RULES:
- If text mentions "Q.X to Q.Y" or "Questions X-Y" → It's a PARENT with CHILDREN
- If there's a passage/data followed by numbered questions → PARENT-CHILD
- PARENT has NO options (A,B,C,D) - it's context only
- CHILDREN have options and reference the parent context
- Each group needs unique groupId (group_1, group_2, etc.)

STANDALONE QUESTIONS (Independent):
- Single MCQ with complete context in the question itself
- Examples: "What is the capital of India?", "Solve: 15 + 27 = ?"
- Has its own 4 options (A, B, C, D)
- No reference to any passage or external context
- groupId: null, subType: null

===== OUTPUT FORMAT (STRICT JSON) =====
{
  "questions": [
    {
      "question": "Full text of question or passage",
      "optionA": "Option A text (EMPTY STRING \"\" for parent passages)",
      "optionB": "Option B text (EMPTY STRING \"\" for parent passages)",
      "optionC": "Option C text (EMPTY STRING \"\" for parent passages)",
      "optionD": "Option D text (EMPTY STRING \"\" for parent passages)",
      "correct": "A or B or C or D (EMPTY STRING \"\" for parent passages)",
      "subject": "One of: Quantitative Aptitude, Reasoning Ability, English Language, General Awareness, Current Affairs, Banking Awareness, Computer Knowledge, Data Interpretation, Logical Reasoning, Others",
      "questionType": "Parent-child OR Standalone",
      "subType": "parent OR child OR null",
      "groupId": "group_1 OR group_2 OR null",
      "subQuestionNumber": 1 OR 2 OR 3 OR null
    }
  ]
}

===== MANDATORY RULES =====
1. PARENT passages: optionA="", optionB="", optionC="", optionD="", correct=""
2. CHILD questions: MUST have all 4 options filled and correct answer
3. STANDALONE: All 4 options filled, correct answer, groupId=null, subType=null
4. Same group = same groupId (parent + all its children)
5. Extract EVERY visible question - do not skip any
6. Detect correct answer from marking/highlighting if visible
7. If answer not visible, make educated guess based on question type

Return ONLY the JSON object, no explanation or markdown.`
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
                const { subject, difficulty, customPrompt, previousQuestions, questionFormat, numSubQuestions } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                const difficultyText = difficulty || 'medium';
                const subjectName = subject || 'General Knowledge';
                const isParentChild = questionFormat === 'parent-child';
                const subQuestionCount = numSubQuestions || 3;

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

                // Indian Competitive Exam Guidelines
                const examGuidelines = `
INDIAN COMPETITIVE EXAM QUESTION GUIDELINES:
Follow these patterns used in actual Bank PO/Clerk, SSC CGL/CHSL, Railway RRB NTPC/Group D, and UPSC exams:

DIFFICULTY LEVELS:
- Easy: Direct questions, single-step calculations, basic recall (Railway Group D, SSC MTS level)
- Medium: Two-step problems, application of concepts, moderate analysis (Bank Clerk, SSC CHSL level)
- Hard: Multi-step problems, complex analysis, tricky options (Bank PO, SSC CGL, Railway NTPC level)

QUESTION PATTERNS BY SUBJECT:
1. Quantitative Aptitude: Use realistic scenarios (shopping, banking, travel), include Data Interpretation with tables/charts descriptions
2. Reasoning: Include coding patterns (A=1,B=2), direction-based problems, blood relations with Indian names
3. English: Use formal/business English, include passages about Indian economy, culture, environment
4. General Awareness: Focus on current Indian affairs, constitutional bodies, government schemes, banking terms
5. Current Affairs: Recent appointments, awards, summits, sports achievements, government policies

OPTION GUIDELINES:
- Options should be plausible and well-distributed
- Avoid obvious wrong answers
- Include common mistakes as distractors
- For numerical questions, include calculation error traps
- Options should be similar in length and format`;

                // Generate different prompts based on question format
                if (isParentChild) {
                    // Parent-Child format: Passage with multiple sub-questions
                    if (customPrompt && customPrompt.trim()) {
                        prompt = `Generate a PASSAGE-BASED question set based on: "${customPrompt}"
Create a main passage/context and ${subQuestionCount} sub-questions based on it.
This is for Indian competitive exams. Difficulty level: ${difficultyText}.

${examGuidelines}`;
                    } else {
                        prompt = `Generate a PASSAGE-BASED question set for ${subjectName}.
Topic: "${randomTopic}" or "${anotherRandomTopic}".
Create a main passage/context (200-400 words) and ${subQuestionCount} sub-questions based on it.

${examGuidelines}

PASSAGE GUIDELINES for ${subjectName}:
- For English: Use formal passages about Indian economy, environment, technology, social issues
- For Reasoning: Use puzzle-based scenarios (seating arrangements, scheduling, rankings)
- For Quantitative: Use data interpretation with tables/charts (describe the data in text format)
- For General Awareness: Use informative passages about Indian history, polity, economy

Difficulty level: ${difficultyText}`;
                    }

                    prompt += `

Random seed for uniqueness: ${randomSeed}-${timestamp}-${randomTopicIndex}

Return ONLY valid JSON in this EXACT format:
{
  "isParentChild": true,
  "mainQuestionText": "The complete passage or context text (200-400 words). For Reading Comprehension, write a formal passage. For Data Interpretation, describe the table/chart data. For Puzzles, describe the scenario and conditions.",
  "subject": "${subjectName}",
  "difficulty": "${difficultyText}",
  "topic": "Specific topic this covers",
  "subQuestions": [
    {
      "question": "First question based on the passage - test direct comprehension",
      "optionA": "Option A",
      "optionB": "Option B",
      "optionC": "Option C",
      "optionD": "Option D",
      "correct": "A",
      "explanation": "Brief explanation with reference to passage"
    },
    {
      "question": "Second question - test inference or calculation",
      "optionA": "Option A",
      "optionB": "Option B",
      "optionC": "Option C",
      "optionD": "Option D",
      "correct": "B",
      "explanation": "Brief explanation"
    }
  ]
}

CRITICAL REQUIREMENTS:
- Generate exactly ${subQuestionCount} sub-questions in the subQuestions array
- Each sub-question must have exactly 4 options (A, B, C, D)
- The "correct" field must be exactly one letter: A, B, C, or D
- All questions should be answerable from the passage
- Mix question types: 1-2 direct/factual, 1-2 inference/analysis, 1 vocabulary/title if applicable
- Use Indian names, places, and context where appropriate`;
                } else {
                    // Standalone format: Single question
                    if (customPrompt && customPrompt.trim()) {
                        prompt = `Generate a multiple choice question based on: "${customPrompt}"
This is for Indian competitive exams. Difficulty level: ${difficultyText}.

${examGuidelines}`;
                    } else {
                        prompt = `Generate a ${difficultyText} difficulty multiple choice question for ${subjectName}.
Focus on topic: "${randomTopic}" or "${anotherRandomTopic}".

${examGuidelines}

SPECIFIC PATTERNS for ${subjectName}:
${subjectName === 'Quantitative Aptitude' ? `
- Use realistic Indian scenarios (railway tickets, bank interest, shop discounts)
- Include unit conversions where applicable
- For ${difficultyText} level: ${difficultyText === 'easy' ? 'single operation, direct formula' : difficultyText === 'medium' ? 'two operations, concept application' : 'multi-step, tricky calculations'}` : ''}
${subjectName === 'Reasoning Ability' ? `
- Use Indian names (Rahul, Priya, Amit, Sneha, etc.)
- Include clear conditions and constraints
- For ${difficultyText} level: ${difficultyText === 'easy' ? 'direct pattern, 3-4 elements' : difficultyText === 'medium' ? 'moderate complexity, 5-6 elements' : 'complex arrangement, 6-8 elements'}` : ''}
${subjectName === 'English Language' ? `
- Use formal/professional English
- Include vocabulary from business, economics, environment
- For ${difficultyText} level: ${difficultyText === 'easy' ? 'common words, simple grammar' : difficultyText === 'medium' ? 'moderate vocabulary, standard rules' : 'advanced vocabulary, nuanced usage'}` : ''}
${subjectName === 'General Awareness' || subjectName === 'Current Affairs' ? `
- Focus on facts relevant to banking/government job aspirants
- Include recent developments in India
- For ${difficultyText} level: ${difficultyText === 'easy' ? 'well-known facts' : difficultyText === 'medium' ? 'moderate detail required' : 'specific/detailed knowledge needed'}` : ''}`;
                    }

                    // Add previous questions to avoid if provided
                    let avoidText = '';
                    if (previousQuestions && previousQuestions.length > 0) {
                        avoidText = `

DO NOT generate questions similar to these:
${previousQuestions.slice(0, 5).map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
                    }

                    prompt += `${avoidText}

Random seed: ${randomSeed}-${timestamp}-${randomTopicIndex}

Return ONLY valid JSON:
{
  "question": "Complete question text following exam patterns above",
  "optionA": "First option (plausible)",
  "optionB": "Second option (plausible)",
  "optionC": "Third option (plausible)",
  "optionD": "Fourth option (plausible)",
  "correct": "A or B or C or D",
  "explanation": "Brief explanation of why the answer is correct",
  "subject": "${subjectName}",
  "difficulty": "${difficultyText}",
  "topic": "Specific topic covered"
}

Generate a question that could appear in actual ${difficultyText === 'easy' ? 'Railway Group D/SSC MTS' : difficultyText === 'medium' ? 'Bank Clerk/SSC CHSL' : 'Bank PO/SSC CGL'} exam.`;
                }

                // Use higher token limit for parent-child questions (they need more content)
                const maxTokens = isParentChild ? 4096 : 1024;

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
                                temperature: 0.85,
                                topK: 40,
                                topP: 0.95,
                                maxOutputTokens: maxTokens
                            }
                        })
                    }
                );

                const data = await response.json();

                console.log('Gemini API Response Status:', response.status);
                console.log('Gemini API Response:', JSON.stringify(data).substring(0, 500));

                if (!response.ok) {
                    console.error('Gemini API Error:', data);
                    throw new Error(data.error?.message || 'Gemini API request failed');
                }

                // Check if response has the expected structure
                if (!data.candidates || data.candidates.length === 0) {
                    console.error('No candidates in Gemini response:', data);
                    throw new Error('Gemini returned no candidates. The AI might have filtered the content or the request failed.');
                }

                let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                console.log('Extracted text from Gemini (first 500 chars):', text.substring(0, 500));

                if (!text || text.trim().length === 0) {
                    console.error('Empty text from Gemini. Full response:', JSON.stringify(data));
                    throw new Error('Gemini returned empty response. Please try again.');
                }

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
                    // Try to fix common JSON issues with multiple strategies
                    let fixedJson = jsonStr
                        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
                        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
                        .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
                        .replace(/\n/g, ' ')  // Replace newlines with spaces
                        .replace(/\r/g, '') // Remove carriage returns
                        .replace(/\t/g, ' ') // Replace tabs with spaces
                        .replace(/[\u2018\u2019]/g, "'") // Smart single quotes to regular
                        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to regular
                        .replace(/\u2013/g, '-') // En dash to hyphen
                        .replace(/\u2014/g, '--') // Em dash to double hyphen
                        .replace(/\u2026/g, '...') // Ellipsis to dots
                        .replace(/[\u00A0]/g, ' '); // Non-breaking space to regular space

                    try {
                        questionData = JSON.parse(fixedJson);
                    } catch (secondError) {
                        // More aggressive fixing - escape problematic characters in string values
                        console.error('Second parse attempt failed, trying aggressive fix');

                        // Try to fix unescaped quotes within string values
                        fixedJson = fixedJson.replace(/"([^"]*?)"/g, (match, content) => {
                            // Escape any unescaped quotes within the content
                            const fixed = content
                                .replace(/(?<!\\)"/g, '\\"')
                                .replace(/\s+/g, ' ')
                                .trim();
                            return '"' + fixed + '"';
                        });

                        try {
                            questionData = JSON.parse(fixedJson);
                        } catch (thirdError) {
                            // Final fallback - manually extract fields using regex
                            console.error('Third parse attempt failed, using regex extraction');
                            const extractField = (field) => {
                                const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, 'i');
                                const match = jsonStr.match(regex);
                                return match ? match[1].replace(/\\"/g, '"') : '';
                            };

                            questionData = {
                                question: extractField('question') || 'Question could not be parsed',
                                optionA: extractField('optionA') || 'Option A',
                                optionB: extractField('optionB') || 'Option B',
                                optionC: extractField('optionC') || 'Option C',
                                optionD: extractField('optionD') || 'Option D',
                                correct: extractField('correct') || 'A',
                                explanation: extractField('explanation') || 'Explanation not available',
                                subject: extractField('subject') || 'General',
                                difficulty: extractField('difficulty') || 'medium',
                                topic: extractField('topic') || 'General'
                            };

                            // Validate we got at least a question
                            if (!questionData.question || questionData.question === 'Question could not be parsed') {
                                throw new Error('Failed to extract question from AI response');
                            }
                        }
                    }
                }

                // Validate the parsed question data
                console.log('Parsed question data:', JSON.stringify(questionData).substring(0, 300));

                // Ensure required fields exist for standalone questions
                if (!questionData.isParentChild) {
                    if (!questionData.question) {
                        console.error('Missing question field in parsed data:', questionData);
                        throw new Error('AI response missing question field');
                    }

                    // Ensure all options exist
                    questionData.optionA = questionData.optionA || 'Option A not provided';
                    questionData.optionB = questionData.optionB || 'Option B not provided';
                    questionData.optionC = questionData.optionC || 'Option C not provided';
                    questionData.optionD = questionData.optionD || 'Option D not provided';
                    questionData.correct = questionData.correct || 'A';
                    questionData.explanation = questionData.explanation || 'No explanation provided';
                    questionData.subject = questionData.subject || 'General';
                    questionData.difficulty = questionData.difficulty || 'medium';
                }

                console.log('Sending response to frontend:', JSON.stringify({
                    success: true,
                    data: questionData
                }).substring(0, 500));

                return res.status(200).json({
                    success: true,
                    data: questionData
                });

            } catch (error) {
                console.error('Gemini generation error:', error);
                console.error('Error stack:', error.stack);
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
