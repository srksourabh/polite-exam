const Airtable = require('airtable');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// =====================================================
// AIRTABLE CONFIGURATION
// =====================================================
// IMPORTANT: This uses Airtable Personal Access Token
// Your token should start with "pat" (e.g., patXXXXXXXXXXXXXX)
//
// Set this environment variable in Vercel:
// AIRTABLE_PERSONAL_ACCESS_TOKEN = your_token_here
// =====================================================

// Validate required environment variables
if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    console.error('WARNING: AIRTABLE_PERSONAL_ACCESS_TOKEN is not configured');
}
if (!process.env.AIRTABLE_BASE_ID) {
    console.error('WARNING: AIRTABLE_BASE_ID is not configured');
}

const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

// =====================================================
// SECURITY UTILITIES
// =====================================================

// Sanitize input for Airtable formulas to prevent injection attacks
function sanitizeForFormula(input) {
    if (typeof input !== 'string') return '';
    // Escape single quotes and backslashes which can break formulas
    return input
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate mobile number (10 digits)
function isValidMobile(mobile) {
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(mobile);
}

// Validate exam code format (alphanumeric with underscores)
function isValidExamCode(code) {
    const codeRegex = /^[A-Za-z0-9_-]+$/;
    return codeRegex.test(code) && code.length <= 50;
}

// Generate cryptographically secure random password
function generateSecurePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += chars[randomBytes[i] % chars.length];
    }
    return password;
}

// Simple password hashing (for demonstration - in production use bcrypt)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + process.env.PASSWORD_SALT || 'polite-salt').digest('hex');
}

// Generate verification token
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

// =====================================================
// EMAIL SERVICE CONFIGURATION
// =====================================================
// Configure email transporter using Nodemailer
// Set these environment variables:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL

function getEmailTransporter() {
    // Check if email is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.log('⚠️ Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in environment.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

// Send verification email
async function sendVerificationEmail(email, name, verificationToken) {
    const transporter = getEmailTransporter();
    const appUrl = process.env.APP_URL || 'https://polite-exam.vercel.app';
    const verificationLink = `${appUrl}?verify=${verificationToken}`;

    if (!transporter) {
        console.log('📧 [DEV MODE] Verification link:', verificationLink);
        return { success: true, devMode: true, verificationLink };
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Verify Your Polite Coaching Centre Account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; color: #f1c40f;">POLITE COACHING CENTRE</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Verification</p>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Hello ${name}!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Thank you for creating an account with Polite Coaching Centre.
                        Please click the button below to verify your email address and activate your account.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}"
                           style="background: #27ae60; color: white; padding: 15px 30px; text-decoration: none;
                                  border-radius: 8px; font-weight: bold; display: inline-block;">
                            Verify My Email
                        </a>
                    </div>
                    <p style="color: #999; font-size: 0.9rem;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="${verificationLink}" style="color: #3498db; word-break: break-all;">${verificationLink}</a>
                    </p>
                    <p style="color: #999; font-size: 0.9rem; margin-top: 20px;">
                        If you didn't create this account, please ignore this email.
                    </p>
                </div>
                <p style="text-align: center; color: #999; font-size: 0.8rem; margin-top: 20px;">
                    © Polite Coaching Centre - Reasoning, Math & GK Tests for Job Aspirants
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to send verification email:', error);
        return { success: false, error: error.message };
    }
}

// Send password email (for signup or forgot password)
async function sendPasswordEmail(email, name, password, isTemporary = false) {
    const transporter = getEmailTransporter();
    const appUrl = process.env.APP_URL || 'https://polite-exam.vercel.app';

    if (!transporter) {
        console.log(`📧 [DEV MODE] Password for ${email}: ${password}`);
        return { success: true, devMode: true, password };
    }

    const subject = isTemporary
        ? 'Your Temporary Password - Polite Coaching Centre'
        : 'Your Account Password - Polite Coaching Centre';

    const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; color: #f1c40f;">POLITE COACHING CENTRE</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">${isTemporary ? 'Password Reset' : 'Account Created'}</p>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Hello ${name}!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        ${isTemporary
                            ? 'Your password has been reset. Here is your new temporary password:'
                            : 'Your account has been created successfully! Here is your password:'}
                    </p>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #3498db;">
                        <span style="font-family: monospace; font-size: 1.5rem; font-weight: bold; color: #2c3e50; letter-spacing: 2px;">
                            ${password}
                        </span>
                    </div>
                    <p style="color: #e74c3c; font-weight: 500;">
                        ⚠️ Please change this password after logging in for security reasons.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${appUrl}"
                           style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none;
                                  border-radius: 8px; font-weight: bold; display: inline-block;">
                            Login to Your Account
                        </a>
                    </div>
                    <p style="color: #999; font-size: 0.9rem;">
                        If you didn't request this, please contact support immediately.
                    </p>
                </div>
                <p style="text-align: center; color: #999; font-size: 0.8rem; margin-top: 20px;">
                    © Polite Coaching Centre - Reasoning, Math & GK Tests for Job Aspirants
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Password email sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to send password email:', error);
        return { success: false, error: error.message };
    }
}

// Rate limiting storage (in-memory, resets on server restart)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;
const AUTH_RATE_LIMIT_MAX = 5;

function checkRateLimit(ip, isAuthRoute = false) {
    const now = Date.now();
    const key = `${ip}:${isAuthRoute ? 'auth' : 'general'}`;
    const limit = isAuthRoute ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX_REQUESTS;

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    const record = rateLimitStore.get(key);
    if (now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (record.count >= limit) {
        return false;
    }

    record.count++;
    return true;
}

// Get client IP address
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           'unknown';
}

// Tables
const QUESTIONS_TABLE = 'Questions';
const EXAMS_TABLE = 'Exams';
const RESULTS_TABLE = 'Results';
const CANDIDATES_TABLE = 'Candidates';

// CORS headers - configurable via environment variable
// Capacitor apps send origin as 'capacitor://localhost' or 'http://localhost'
const CAPACITOR_ORIGINS = [
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
    'ionic://localhost',
    'http://localhost:8100'  // Ionic dev server
];

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? [...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...CAPACITOR_ORIGINS]
    : ['*']; // Default to allow all for development

function getCorsHeaders(req) {
    const origin = req.headers.origin;

    // For Capacitor/mobile apps, always allow their origins
    if (origin && CAPACITOR_ORIGINS.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        };
    }

    // For requests without origin (like curl, Postman, or same-origin), allow
    if (!origin) {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        };
    }

    // For web origins
    const allowedOrigin = ALLOWED_ORIGINS.includes('*')
        ? '*'
        : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
    };
}

// Main handler
module.exports = async (req, res) => {
    const clientIP = getClientIP(req);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        const corsHeaders = getCorsHeaders(req);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        return res.status(200).json({ success: true });
    }

    // Set CORS and security headers
    const corsHeaders = getCorsHeaders(req);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    const { url, method } = req;

    // Check rate limiting for auth routes
    const isAuthRoute = url.includes('/auth/');
    if (!checkRateLimit(clientIP, isAuthRoute)) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.'
        });
    }

    try {
        // Health check with system status
        if (url === '/api/health') {
            const systemStatus = {
                airtable: {
                    status: 'connected',
                    message: 'Airtable database connected'
                },
                gemini: {
                    status: process.env.GEMINI_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.GEMINI_API_KEY ? 'Gemini AI ready' : 'API key not configured'
                },
                ocr: {
                    status: process.env.OCR_SPACE_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.OCR_SPACE_API_KEY ? 'OCR service ready' : 'API key not configured'
                }
            };
            
            return res.status(200).json({ 
                status: 'ok', 
                message: 'System health check',
                services: systemStatus,
                timestamp: new Date().toISOString()
            });
        }

        // GET /api/questions - List all questions
        if (url === '/api/questions' && method === 'GET') {
            const records = await base(QUESTIONS_TABLE).select().all();
            const questions = records.map(record => ({
                id: record.id,
                ...record.fields
            }));
            return res.status(200).json({ success: true, data: questions });
        }

        // POST /api/questions - Create new question
        if (url === '/api/questions' && method === 'POST') {
            const questionData = req.body;
            const record = await base(QUESTIONS_TABLE).create(questionData);
            return res.status(201).json({ 
                success: true, 
                data: { id: record.id, ...record.fields } 
            });
        }

        // PUT /api/questions/:id - Update question
        if (url.startsWith('/api/questions/') && method === 'PUT') {
            const questionId = url.split('/api/questions/')[1];
            const updateData = req.body;
            const record = await base(QUESTIONS_TABLE).update(questionId, updateData);
            return res.status(200).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // DELETE /api/questions/:id - Delete question
        if (url.startsWith('/api/questions/') && method === 'DELETE') {
            const questionId = url.split('/api/questions/')[1];
            await base(QUESTIONS_TABLE).destroy(questionId);
            return res.status(200).json({
                success: true,
                message: 'Question deleted successfully'
            });
        }

        // POST /api/questions/migrate - Migrate all questions to new ID format (Q0001, Q0002, etc.)
        if (url === '/api/questions/migrate' && method === 'POST') {
            try {
                // Get all questions
                const records = await base(QUESTIONS_TABLE).select().all();

                // Sort by current ID to maintain order
                const sortedRecords = records.sort((a, b) => {
                    const idA = a.fields.ID || '';
                    const idB = b.fields.ID || '';

                    // Extract numbers from IDs
                    const matchA = idA.match(/^[qQ](\d+)$/);
                    const matchB = idB.match(/^[qQ](\d+)$/);
                    const numA = matchA ? parseInt(matchA[1]) : 0;
                    const numB = matchB ? parseInt(matchB[1]) : 0;

                    return numA - numB;
                });

                // Update each question with new format
                const updates = [];
                for (let i = 0; i < sortedRecords.length; i++) {
                    const record = sortedRecords[i];
                    const newId = 'Q' + String(i + 1).padStart(4, '0');

                    updates.push({
                        id: record.id,
                        fields: {
                            ID: newId
                        }
                    });
                }

                // Batch update (Airtable allows up to 10 records per batch)
                const batchSize = 10;
                for (let i = 0; i < updates.length; i += batchSize) {
                    const batch = updates.slice(i, i + batchSize);
                    await base(QUESTIONS_TABLE).update(batch);
                }

                return res.status(200).json({
                    success: true,
                    message: `Successfully migrated ${updates.length} questions to new format`,
                    count: updates.length
                });
            } catch (error) {
                console.error('Migration error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        // GET /api/debug - Debug endpoint to inspect data structure
        if (url === '/api/debug' && method === 'GET') {
            try {
                const examRecords = await base(EXAMS_TABLE).select({ maxRecords: 3 }).all();
                const questionRecords = await base(QUESTIONS_TABLE).select({ maxRecords: 3 }).all();

                const examsDebug = examRecords.map(record => ({
                    airtableId: record.id,
                    fields: record.fields,
                    fieldNames: Object.keys(record.fields)
                }));

                const questionsDebug = questionRecords.map(record => ({
                    airtableId: record.id,
                    fields: record.fields,
                    fieldNames: Object.keys(record.fields)
                }));

                return res.status(200).json({
                    success: true,
                    message: 'Debug info for data structure',
                    exams: examsDebug,
                    questions: questionsDebug
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        // GET /api/exams - List all exams
        if (url === '/api/exams' && method === 'GET') {
            const records = await base(EXAMS_TABLE).select().all();
            const exams = records.map(record => ({
                id: record.id,
                ...record.fields
            }));
            return res.status(200).json({ success: true, data: exams });
        }

        // POST /api/exams - Create new exam
        if (url === '/api/exams' && method === 'POST') {
            try {
                const examData = req.body;

                // Get question IDs value - prioritize 'Questions' as it's the correct Airtable field name
                const questionIdsValue = examData['Questions'] || examData['Question IDs'] || examData['questionIds'];

                // Try different possible field name variations for Question IDs
                // 'Questions' is the correct field name in Airtable (linked record field)
                const fieldVariations = [
                    'Questions',      // Correct Airtable field name (linked record)
                    'Question IDs',
                    'QuestionIDs',
                    'questionIds',
                    'question_ids'
                ];

                let lastError = null;

                // Try each field name variation
                for (const fieldName of fieldVariations) {
                    try {
                        const mappedData = {
                            'Exam Code': examData['Exam Code'],
                            'Title': examData['Title'],
                            'Duration (mins)': examData['Duration (mins)'],
                            'Expiry (IST)': examData['Expiry (IST)'],
                            [fieldName]: questionIdsValue
                        };

                        console.log(`Attempting to create exam with field name: "${fieldName}"`);
                        console.log('Data:', JSON.stringify(mappedData, null, 2));

                        const record = await base(EXAMS_TABLE).create(mappedData);

                        console.log(`✅ Success! Correct field name is: "${fieldName}"`);

                        return res.status(201).json({
                            success: true,
                            data: { id: record.id, ...record.fields }
                        });
                    } catch (err) {
                        lastError = err;
                        console.log(`❌ Failed with field name "${fieldName}":`, err.message);

                        // If this is not a field name error, throw immediately
                        if (!err.message.includes('Unknown field') && !err.message.includes('unknown field')) {
                            throw err;
                        }
                        // Otherwise, continue to next variation
                    }
                }

                // If all variations failed, throw the last error
                throw new Error(`Failed to create exam. Tried field names: ${fieldVariations.join(', ')}. Last error: ${lastError.message}`);

            } catch (error) {
                console.error('Error creating exam:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to create exam'
                });
            }
        }

        // GET /api/exams/:code - Get exam by code
        if (url.startsWith('/api/exams/') && method === 'GET') {
            const examCode = url.split('/api/exams/')[1];

            // Validate exam code format
            if (!isValidExamCode(examCode)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid exam code format'
                });
            }

            const sanitizedExamCode = sanitizeForFormula(examCode);
            const records = await base(EXAMS_TABLE)
                .select({
                    filterByFormula: `{Exam Code} = '${sanitizedExamCode}'`
                })
                .all();
            
            if (records.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const exam = {
                id: records[0].id,
                ...records[0].fields
            };
            
            return res.status(200).json({ success: true, data: exam });
        }

        // POST /api/auth/candidate/signup - Create candidate account
        if (url === '/api/auth/candidate/signup' && method === 'POST') {
            try {
                const { name, email, mobile, password } = req.body;

                // Name, email, password required; mobile is optional
                if (!name || !email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Name, email, and password are required'
                    });
                }

                // Validate input formats
                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Mobile is optional but must be valid if provided
                if (mobile && !isValidMobile(mobile)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Mobile number must be exactly 10 digits'
                    });
                }

                if (password.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: 'Password must be at least 6 characters'
                    });
                }

                if (name.length < 2 || name.length > 100) {
                    return res.status(400).json({
                        success: false,
                        error: 'Name must be between 2 and 100 characters'
                    });
                }

                // Sanitize inputs for formula
                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Check if candidate already exists by email
                const existingCandidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (existingCandidates.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'An account with this email already exists'
                    });
                }

                // Hash the password before storing
                const hashedPassword = hashPassword(password);

                // Generate verification token
                const verificationToken = generateVerificationToken();

                // Create candidate record with hashed password and verification token
                const candidateData = {
                    'Name': name.trim(),
                    'Email': email.toLowerCase().trim(),
                    'Password': hashedPassword,
                    'Verified': false,
                    'VerificationToken': verificationToken
                };

                // Add mobile if provided
                if (mobile) {
                    candidateData['Mobile'] = mobile.trim();
                }

                const record = await base(CANDIDATES_TABLE).create(candidateData);

                // Send verification email
                const emailResult = await sendVerificationEmail(email.toLowerCase(), name, verificationToken);

                return res.status(201).json({
                    success: true,
                    message: 'Account created! Please check your email to verify your account.',
                    requiresVerification: true,
                    data: {
                        id: record.id,
                        name: record.fields.Name,
                        email: record.fields.Email,
                        mobile: record.fields.Mobile || ''
                    },
                    // Include verification link in dev mode (when email is not configured)
                    ...(emailResult.devMode ? { devVerificationLink: emailResult.verificationLink } : {})
                });
            } catch (error) {
                console.error('Signup error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create account. Please try again.'
                });
            }
        }

        // POST /api/auth/candidate/login - Candidate login
        if (url === '/api/auth/candidate/login' && method === 'POST') {
            try {
                const { email, password } = req.body;

                if (!email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email and password are required'
                    });
                }

                // Validate email format
                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Sanitize email for formula
                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Find candidate by email
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid email or password'
                    });
                }

                const candidate = candidates[0];

                // Check if account is verified
                // If Verified field doesn't exist (legacy account), treat as verified
                const isVerified = candidate.fields.Verified === undefined || candidate.fields.Verified === true;

                if (!isVerified) {
                    return res.status(403).json({
                        success: false,
                        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
                        requiresVerification: true,
                        email: email
                    });
                }

                // Hash the provided password and compare with stored hash
                // Support both hashed (new) and plaintext (legacy) passwords during migration
                const hashedPassword = hashPassword(password);
                const storedPassword = candidate.fields.Password;

                // Check if stored password is hashed (64 char hex) or plaintext
                const isHashedPassword = /^[a-f0-9]{64}$/i.test(storedPassword);

                let passwordMatch = false;
                if (isHashedPassword) {
                    // Compare with hashed password
                    passwordMatch = storedPassword === hashedPassword;
                } else {
                    // Legacy: compare with plaintext password
                    passwordMatch = storedPassword === password;

                    // Optionally migrate to hashed password on successful login
                    if (passwordMatch) {
                        try {
                            await base(CANDIDATES_TABLE).update(candidate.id, {
                                'Password': hashedPassword
                            });
                            console.log(`Migrated password for ${email} to hashed format`);
                        } catch (migrationError) {
                            console.error('Password migration failed:', migrationError);
                            // Continue anyway - login still succeeds
                        }
                    }
                }

                if (!passwordMatch) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid email or password'
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    data: {
                        id: candidate.id,
                        name: candidate.fields.Name,
                        email: candidate.fields.Email,
                        mobile: candidate.fields.Mobile || ''
                    }
                });
            } catch (error) {
                console.error('Login error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to login. Please try again.'
                });
            }
        }

        // POST /api/auth/admin/login - Admin login
        // IMPORTANT: Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables in production!
        if (url === '/api/auth/admin/login' && method === 'POST') {
            try {
                const { username, password } = req.body;

                if (!username || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Username and password are required'
                    });
                }

                // Get admin credentials from environment variables (with fallback for development)
                const adminUsername = process.env.ADMIN_USERNAME || 'admin';
                const adminPassword = process.env.ADMIN_PASSWORD || 'politeadmin';

                // Compare credentials (constant-time comparison to prevent timing attacks)
                const usernameMatch = username === adminUsername;
                const passwordMatch = password === adminPassword;

                if (usernameMatch && passwordMatch) {
                    return res.status(200).json({
                        success: true,
                        message: 'Admin login successful',
                        data: {
                            username: adminUsername,
                            role: 'admin'
                        }
                    });
                } else {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid admin credentials'
                    });
                }
            } catch (error) {
                console.error('Admin login error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to login. Please try again.'
                });
            }
        }

        // POST /api/auth/reset-password - Reset candidate password
        if (url === '/api/auth/reset-password' && method === 'POST') {
            try {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email is required'
                    });
                }

                // Validate email format
                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Sanitize email for formula
                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Find candidate by email
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    // Return generic message to prevent email enumeration
                    return res.status(200).json({
                        success: true,
                        message: 'If an account exists with this email, a password reset email has been sent.'
                    });
                }

                const candidate = candidates[0];

                // Generate a cryptographically secure temporary password
                const tempPassword = generateSecurePassword(12);

                // Hash the temporary password before storing
                const hashedTempPassword = hashPassword(tempPassword);

                // Update the password in Airtable
                await base(CANDIDATES_TABLE).update(candidate.id, {
                    'Password': hashedTempPassword
                });

                // Send password via email
                const emailResult = await sendPasswordEmail(
                    email.toLowerCase(),
                    candidate.fields.Name,
                    tempPassword,
                    true // isTemporary
                );

                console.log(`Password reset for ${email}. Email sent: ${emailResult.success}`);

                return res.status(200).json({
                    success: true,
                    message: 'Password reset successful. Check your email for the new temporary password.',
                    // Include temp password in dev mode (when email is not configured)
                    ...(emailResult.devMode ? {
                        data: {
                            tempPassword: tempPassword,
                            note: 'DEV MODE: In production, this will only be sent via email.'
                        }
                    } : {})
                });
            } catch (error) {
                console.error('Password reset error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to reset password. Please try again.'
                });
            }
        }

        // GET /api/auth/verify/:token - Verify email address
        if (url.startsWith('/api/auth/verify/') && method === 'GET') {
            try {
                const token = url.split('/api/auth/verify/')[1];

                if (!token || token.length !== 64) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid verification token'
                    });
                }

                // Sanitize token for formula
                const sanitizedToken = sanitizeForFormula(token);

                // Find candidate by verification token
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{VerificationToken} = '${sanitizedToken}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Invalid or expired verification link'
                    });
                }

                const candidate = candidates[0];

                // Check if already verified
                if (candidate.fields.Verified === true) {
                    return res.status(200).json({
                        success: true,
                        message: 'Your email is already verified. You can now login.',
                        alreadyVerified: true
                    });
                }

                // Update candidate to verified status
                await base(CANDIDATES_TABLE).update(candidate.id, {
                    'Verified': true,
                    'VerificationToken': '' // Clear the token after use
                });

                console.log(`✅ Email verified for ${candidate.fields.Email}`);

                return res.status(200).json({
                    success: true,
                    message: 'Email verified successfully! You can now login to your account.',
                    data: {
                        name: candidate.fields.Name,
                        email: candidate.fields.Email
                    }
                });
            } catch (error) {
                console.error('Verification error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to verify email. Please try again.'
                });
            }
        }

        // POST /api/auth/resend-verification - Resend verification email
        if (url === '/api/auth/resend-verification' && method === 'POST') {
            try {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email is required'
                    });
                }

                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    // Return generic message to prevent email enumeration
                    return res.status(200).json({
                        success: true,
                        message: 'If an account exists with this email, a verification link has been sent.'
                    });
                }

                const candidate = candidates[0];

                // Check if already verified
                if (candidate.fields.Verified === true) {
                    return res.status(400).json({
                        success: false,
                        error: 'This email is already verified. Please login.'
                    });
                }

                // Generate new verification token
                const verificationToken = generateVerificationToken();

                // Update token in database
                await base(CANDIDATES_TABLE).update(candidate.id, {
                    'VerificationToken': verificationToken
                });

                // Send verification email
                const emailResult = await sendVerificationEmail(
                    email.toLowerCase(),
                    candidate.fields.Name,
                    verificationToken
                );

                return res.status(200).json({
                    success: true,
                    message: 'Verification email sent. Please check your inbox.',
                    ...(emailResult.devMode ? { devVerificationLink: emailResult.verificationLink } : {})
                });
            } catch (error) {
                console.error('Resend verification error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to resend verification email. Please try again.'
                });
            }
        }

        // GET /api/candidates/profile/:email - Get candidate profile
        if (url.startsWith('/api/candidates/profile/') && method === 'GET') {
            try {
                const email = decodeURIComponent(url.split('/api/candidates/profile/')[1]);

                // Validate email format
                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Sanitize email for formula
                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Candidate not found'
                    });
                }

                const candidate = candidates[0];

                return res.status(200).json({
                    success: true,
                    data: {
                        id: candidate.id,
                        name: candidate.fields.Name,
                        email: candidate.fields.Email,
                        mobile: candidate.fields.Mobile || '',
                        profileImage: candidate.fields.ProfileImage || ''
                    }
                });
            } catch (error) {
                console.error('Get profile error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to get profile. Please try again.'
                });
            }
        }

        // PUT /api/candidates/profile - Update candidate profile
        if (url === '/api/candidates/profile' && method === 'PUT') {
            try {
                const { email, name, mobile, profileImage } = req.body;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email is required'
                    });
                }

                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Validate mobile if provided
                if (mobile && !isValidMobile(mobile)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Mobile number must be exactly 10 digits'
                    });
                }

                // Validate name if provided
                if (name && (name.length < 2 || name.length > 100)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Name must be between 2 and 100 characters'
                    });
                }

                // Validate profile image size (max 500KB base64)
                if (profileImage && profileImage.length > 700000) {
                    return res.status(400).json({
                        success: false,
                        error: 'Profile image is too large. Maximum size is 500KB.'
                    });
                }

                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Find candidate
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Candidate not found'
                    });
                }

                const candidate = candidates[0];

                // Build update object with only provided fields
                const updateData = {};
                if (name) updateData['Name'] = name.trim();
                if (mobile !== undefined) updateData['Mobile'] = mobile.trim();
                if (profileImage !== undefined) updateData['ProfileImage'] = profileImage;

                // Update candidate record
                await base(CANDIDATES_TABLE).update(candidate.id, updateData);

                console.log(`✅ Profile updated for ${email}`);

                return res.status(200).json({
                    success: true,
                    message: 'Profile updated successfully',
                    data: {
                        name: name || candidate.fields.Name,
                        email: candidate.fields.Email,
                        mobile: mobile !== undefined ? mobile : candidate.fields.Mobile,
                        profileImage: profileImage !== undefined ? profileImage : candidate.fields.ProfileImage
                    }
                });
            } catch (error) {
                console.error('Update profile error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update profile. Please try again.'
                });
            }
        }

        // PUT /api/candidates/password - Change candidate password
        if (url === '/api/candidates/password' && method === 'PUT') {
            try {
                const { email, currentPassword, newPassword } = req.body;

                if (!email || !currentPassword || !newPassword) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email, current password, and new password are required'
                    });
                }

                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                if (newPassword.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: 'New password must be at least 6 characters'
                    });
                }

                if (currentPassword === newPassword) {
                    return res.status(400).json({
                        success: false,
                        error: 'New password must be different from current password'
                    });
                }

                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Find candidate
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Candidate not found'
                    });
                }

                const candidate = candidates[0];
                const storedPassword = candidate.fields.Password;

                // Verify current password
                const hashedCurrentPassword = hashPassword(currentPassword);
                const isHashedPassword = /^[a-f0-9]{64}$/i.test(storedPassword);

                let passwordMatch = false;
                if (isHashedPassword) {
                    passwordMatch = storedPassword === hashedCurrentPassword;
                } else {
                    passwordMatch = storedPassword === currentPassword;
                }

                if (!passwordMatch) {
                    return res.status(401).json({
                        success: false,
                        error: 'Current password is incorrect'
                    });
                }

                // Hash and update new password
                const hashedNewPassword = hashPassword(newPassword);
                await base(CANDIDATES_TABLE).update(candidate.id, {
                    'Password': hashedNewPassword
                });

                console.log(`✅ Password changed for ${email}`);

                return res.status(200).json({
                    success: true,
                    message: 'Password changed successfully'
                });
            } catch (error) {
                console.error('Change password error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to change password. Please try again.'
                });
            }
        }

        // GET /api/candidates/exams/:email - Get candidate's exam history
        if (url.startsWith('/api/candidates/exams/') && method === 'GET') {
            try {
                const email = decodeURIComponent(url.split('/api/candidates/exams/')[1]);

                // Validate email format
                if (!isValidEmail(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid email format'
                    });
                }

                // Sanitize email for formula
                const sanitizedEmail = sanitizeForFormula(email.toLowerCase());

                // Get candidate
                const candidates = await base(CANDIDATES_TABLE)
                    .select({
                        filterByFormula: `{Email} = '${sanitizedEmail}'`
                    })
                    .all();

                if (candidates.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Candidate not found'
                    });
                }

                const candidate = candidates[0];
                const candidateName = candidate.fields.Name;
                const candidateMobile = candidate.fields.Mobile;

                // Sanitize name and mobile for formula
                const sanitizedName = sanitizeForFormula(candidateName);
                const sanitizedMobile = sanitizeForFormula(candidateMobile);

                // Get all results for this candidate (by name and mobile)
                const results = await base(RESULTS_TABLE)
                    .select({
                        filterByFormula: `AND({Name} = '${sanitizedName}', {Mobile} = '${sanitizedMobile}')`
                    })
                    .all();

                // Build exam history with exam codes from linked Exam records
                const examHistory = await Promise.all(results.map(async (record) => {
                    let examCode = 'N/A';

                    // Get exam code from linked Exam record
                    const examLinkedIds = record.fields['Exam'];
                    if (examLinkedIds && examLinkedIds.length > 0) {
                        try {
                            const examRecord = await base(EXAMS_TABLE).find(examLinkedIds[0]);
                            examCode = examRecord.fields['Exam Code'] || 'N/A';
                        } catch (examError) {
                            console.error('Could not fetch linked exam:', examError);
                        }
                    }

                    return {
                        id: record.id,
                        examCode: examCode,
                        score: record.fields.Score,
                        answers: record.fields.Answers,
                        date: record.fields['Created'] || record.fields['Date'] || new Date().toISOString()
                    };
                }));

                return res.status(200).json({
                    success: true,
                    data: {
                        candidate: {
                            name: candidateName,
                            email: email,
                            mobile: candidateMobile
                        },
                        examsGiven: examHistory.length,
                        examHistory: examHistory
                    }
                });
            } catch (error) {
                console.error('Get exam history error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to get exam history. Please try again.'
                });
            }
        }

        // POST /api/results - Create new result
        if (url === '/api/results' && method === 'POST') {
            const resultData = req.body;

            // Define valid fields for the Results table in Airtable
            // This prevents errors from unknown field names
            const validResultFields = [
                'Name', 'Mobile', 'Score', 'Answers', 'Exam', 'Exam Code',
                'Total Questions', 'Correct Answers', 'Wrong Answers', 'Percentage',
                'Time Taken', 'Date', 'Status'
            ];

            // Filter out unknown fields to prevent Airtable errors
            const cleanedResultData = {};
            for (const key of Object.keys(resultData)) {
                if (validResultFields.includes(key)) {
                    cleanedResultData[key] = resultData[key];
                } else {
                    console.log(`Ignoring unknown field in result submission: ${key}`);
                }
            }

            // Keep 'Exam Code' field for easy querying of results by exam
            // The linked 'Exam' field is also kept for proper data relationships

            // Clean up the Exam field - remove null/undefined values from the array
            // or remove the field entirely if it's invalid
            if (cleanedResultData.Exam) {
                if (Array.isArray(cleanedResultData.Exam)) {
                    // Filter out null, undefined, and empty string values
                    cleanedResultData.Exam = cleanedResultData.Exam.filter(id => id != null && id !== '');
                    // If array is empty after filtering, remove the field entirely
                    if (cleanedResultData.Exam.length === 0) {
                        delete cleanedResultData.Exam;
                    }
                } else if (cleanedResultData.Exam == null || cleanedResultData.Exam === '') {
                    // If Exam is a single null/empty value, remove it
                    delete cleanedResultData.Exam;
                }
            }

            // Auto-create candidate record if it doesn't exist (requirement #9)
            if (cleanedResultData.Name && cleanedResultData.Mobile) {
                try {
                    // Sanitize inputs for formula
                    const sanitizedName = sanitizeForFormula(cleanedResultData.Name);
                    const sanitizedMobile = sanitizeForFormula(cleanedResultData.Mobile);

                    // Check if candidate already exists
                    const existingCandidates = await base(CANDIDATES_TABLE)
                        .select({
                            filterByFormula: `AND({Name} = '${sanitizedName}', {Mobile} = '${sanitizedMobile}')`
                        })
                        .all();

                    // Create candidate if doesn't exist
                    if (existingCandidates.length === 0) {
                        await base(CANDIDATES_TABLE).create({
                            'Name': cleanedResultData.Name,
                            'Mobile': cleanedResultData.Mobile
                        });
                        console.log(`✅ Created new candidate: ${cleanedResultData.Name} (${cleanedResultData.Mobile})`);
                    }
                } catch (candidateError) {
                    console.error('Warning: Could not create candidate record:', candidateError);
                    // Continue anyway - don't fail result submission if candidate creation fails
                }
            }

            // Create the result record using cleaned data
            const record = await base(RESULTS_TABLE).create(cleanedResultData);
            return res.status(201).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // GET /api/results/:examCode - Get results by exam code
        if (url.startsWith('/api/results/') && method === 'GET') {
            const examCode = url.split('/api/results/')[1];

            // Validate exam code format
            if (!isValidExamCode(examCode)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid exam code format'
                });
            }

            // Sanitize exam code for formula
            const sanitizedExamCode = sanitizeForFormula(examCode);

            // First verify the exam exists and get its ID
            const examRecords = await base(EXAMS_TABLE)
                .select({
                    filterByFormula: `{Exam Code} = '${sanitizedExamCode}'`
                })
                .all();

            if (examRecords.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Exam not found'
                });
            }

            const examId = examRecords[0].id;
            let resultRecords = [];

            // Get all results and filter by linked Exam field
            try {
                const allResults = await base(RESULTS_TABLE).select().all();
                resultRecords = allResults.filter(record => {
                    const linkedExams = record.fields['Exam'];
                    if (Array.isArray(linkedExams)) {
                        return linkedExams.includes(examId);
                    }
                    return false;
                });
                console.log(`Found ${resultRecords.length} results for exam: ${examCode}`);
            } catch (err) {
                console.log('Error fetching results:', err.message);
            }

            const results = resultRecords.map(record => ({
                id: record.id,
                ...record.fields,
                // Add examCode to the result for display purposes
                'Exam Code': examCode
            }));

            return res.status(200).json({ success: true, data: results });
        }

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

                // Call Gemini Vision API with latest model
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
                                        text: `You are an expert question extraction system. Extract ALL questions from this image with their options and identify the correct answer.

IMPORTANT INSTRUCTIONS:
1. Extract EVERY question you see in the image
2. Look for visual cues for correct answers: bold text, underlined text, checkmarks, circles, or any other marking
3. If you cannot identify the correct answer from visual cues, analyze the content and make your best determination
4. Return the data in this EXACT JSON format:

{
  "questions": [
    {
      "question": "Full question text here",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correct": "A or B or C or D (the letter of correct answer)",
      "subject": "Math or GK or Reasoning or Others"
    }
  ]
}

Extract ALL questions you can find. Return ONLY valid JSON, no other text.`
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

                // Extract text from Gemini response
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Parse JSON from response
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

                // Build the prompt
                let prompt = '';
                if (customPrompt && customPrompt.trim()) {
                    prompt = `Generate a multiple choice question based on this request: "${customPrompt}"`;
                } else {
                    const difficultyText = difficulty || 'medium';
                    prompt = `Generate a ${difficultyText} difficulty multiple choice question for ${subject || 'General Knowledge'} topic suitable for competitive exams like Railway, Banking, SSC, etc.`;
                }

                prompt += `\n\nReturn ONLY valid JSON in this EXACT format (no other text):
{
  "question": "The complete question text",
  "optionA": "First option",
  "optionB": "Second option",
  "optionC": "Third option",
  "optionD": "Fourth option",
  "correct": "A or B or C or D",
  "explanation": "Brief explanation of the correct answer",
  "subject": "${subject || 'Others'}",
  "difficulty": "${difficulty || 'medium'}"
}

Make sure the question is unique, relevant, and has one clearly correct answer.`;

                // Call Gemini API with latest model
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

                // Extract text from Gemini response
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Parse JSON from response
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

        // POST /api/admin/create-sample-exams - Create sample exams with questions
        if (url === '/api/admin/create-sample-exams' && method === 'POST') {
            try {
                // Sample questions for different subjects with difficulty levels
                const SAMPLE_QUESTIONS = [
                    // Math Questions
                    { ID: 'Q0001', Subject: 'Math', Difficulty: 'Easy', Question: 'What is 15 × 8?', 'Option A': '100', 'Option B': '120', 'Option C': '140', 'Option D': '160', Correct: 'B' },
                    { ID: 'Q0002', Subject: 'Math', Difficulty: 'Easy', Question: 'What is the value of √144?', 'Option A': '10', 'Option B': '11', 'Option C': '12', 'Option D': '13', Correct: 'C' },
                    { ID: 'Q0003', Subject: 'Math', Difficulty: 'Easy', Question: 'What is 25% of 200?', 'Option A': '25', 'Option B': '50', 'Option C': '75', 'Option D': '100', Correct: 'B' },
                    { ID: 'Q0004', Subject: 'Math', Difficulty: 'Medium', Question: 'If x + 7 = 15, what is the value of x?', 'Option A': '6', 'Option B': '7', 'Option C': '8', 'Option D': '9', Correct: 'C' },
                    { ID: 'Q0005', Subject: 'Math', Difficulty: 'Medium', Question: 'What is the area of a rectangle with length 12 cm and width 8 cm?', 'Option A': '20 sq cm', 'Option B': '40 sq cm', 'Option C': '96 sq cm', 'Option D': '120 sq cm', Correct: 'C' },

                    // General Knowledge Questions
                    { ID: 'Q0006', Subject: 'General Knowledge', Difficulty: 'Easy', Question: 'What is the capital of India?', 'Option A': 'New Delhi', 'Option B': 'Mumbai', 'Option C': 'Kolkata', 'Option D': 'Chennai', Correct: 'A' },
                    { ID: 'Q0007', Subject: 'General Knowledge', Difficulty: 'Easy', Question: 'Who is known as the Father of the Nation in India?', 'Option A': 'Jawaharlal Nehru', 'Option B': 'Mahatma Gandhi', 'Option C': 'Subhas Chandra Bose', 'Option D': 'Sardar Patel', Correct: 'B' },
                    { ID: 'Q0008', Subject: 'General Knowledge', Difficulty: 'Medium', Question: 'Which is the largest planet in our solar system?', 'Option A': 'Earth', 'Option B': 'Mars', 'Option C': 'Jupiter', 'Option D': 'Saturn', Correct: 'C' },
                    { ID: 'Q0009', Subject: 'General Knowledge', Difficulty: 'Easy', Question: 'How many continents are there in the world?', 'Option A': '5', 'Option B': '6', 'Option C': '7', 'Option D': '8', Correct: 'C' },
                    { ID: 'Q0010', Subject: 'General Knowledge', Difficulty: 'Medium', Question: 'What is the national animal of India?', 'Option A': 'Lion', 'Option B': 'Tiger', 'Option C': 'Elephant', 'Option D': 'Peacock', Correct: 'B' },

                    // Reasoning Questions
                    { ID: 'Q0011', Subject: 'Reasoning', Difficulty: 'Hard', Question: 'If CAT is coded as 3120, then DOG would be coded as:', 'Option A': '4157', 'Option B': '41507', 'Option C': '4-15-7', 'Option D': '4-15-07', Correct: 'A' },
                    { ID: 'Q0012', Subject: 'Reasoning', Difficulty: 'Medium', Question: 'Complete the series: 2, 6, 12, 20, 30, ?', 'Option A': '40', 'Option B': '42', 'Option C': '44', 'Option D': '46', Correct: 'B' },
                    { ID: 'Q0013', Subject: 'Reasoning', Difficulty: 'Easy', Question: 'Which number is the odd one out: 3, 5, 7, 9, 12, 13?', 'Option A': '3', 'Option B': '7', 'Option C': '12', 'Option D': '13', Correct: 'C' },
                    { ID: 'Q0014', Subject: 'Reasoning', Difficulty: 'Hard', Question: 'If all roses are flowers and all flowers are plants, then:', 'Option A': 'All plants are roses', 'Option B': 'All roses are plants', 'Option C': 'Some plants are flowers', 'Option D': 'No conclusion', Correct: 'B' },
                    { ID: 'Q0015', Subject: 'Reasoning', Difficulty: 'Medium', Question: 'Find the missing number: 5, 10, 20, 40, ?, 160', 'Option A': '60', 'Option B': '70', 'Option C': '80', 'Option D': '90', Correct: 'C' },

                    // English Questions
                    { ID: 'Q0016', Subject: 'English', Difficulty: 'Easy', Question: 'Choose the correct synonym of "Abundant":', 'Option A': 'Scarce', 'Option B': 'Plentiful', 'Option C': 'Limited', 'Option D': 'Rare', Correct: 'B' },
                    { ID: 'Q0017', Subject: 'English', Difficulty: 'Medium', Question: 'Identify the correctly spelled word:', 'Option A': 'Occassion', 'Option B': 'Occasion', 'Option C': 'Ocassion', 'Option D': 'Ocasion', Correct: 'B' },
                    { ID: 'Q0018', Subject: 'English', Difficulty: 'Easy', Question: 'What is the antonym of "Ancient"?', 'Option A': 'Old', 'Option B': 'Modern', 'Option C': 'Historic', 'Option D': 'Traditional', Correct: 'B' },
                    { ID: 'Q0019', Subject: 'English', Difficulty: 'Hard', Question: 'Choose the correct sentence:', 'Option A': 'She don\'t like apples', 'Option B': 'She doesn\'t likes apples', 'Option C': 'She doesn\'t like apples', 'Option D': 'She don\'t likes apples', Correct: 'C' },
                    { ID: 'Q0020', Subject: 'English', Difficulty: 'Easy', Question: 'What is the plural of "Child"?', 'Option A': 'Childs', 'Option B': 'Childes', 'Option C': 'Children', 'Option D': 'Childrens', Correct: 'C' }
                ];

                // Check if questions already exist
                const existingQuestions = await base(QUESTIONS_TABLE).select({ maxRecords: 1 }).all();
                let createdQuestions = [];

                if (existingQuestions.length === 0) {
                    // Create questions in batches of 10
                    const batchSize = 10;
                    for (let i = 0; i < SAMPLE_QUESTIONS.length; i += batchSize) {
                        const batch = SAMPLE_QUESTIONS.slice(i, i + batchSize);
                        const records = await base(QUESTIONS_TABLE).create(batch.map(q => ({ fields: q })));
                        createdQuestions.push(...records);
                    }
                }

                // Get question record IDs
                const questionMap = {};
                for (const q of SAMPLE_QUESTIONS) {
                    const records = await base(QUESTIONS_TABLE)
                        .select({ filterByFormula: `{ID} = '${q.ID}'`, maxRecords: 1 })
                        .all();
                    if (records.length > 0) {
                        questionMap[q.ID] = records[0].id;
                    }
                }

                // Create exams
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 7);
                const expiryIST = expiryDate.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                const SAMPLE_EXAMS = [
                    { 'Exam Code': 'MATH_BASICS_01', Title: 'Basic Mathematics Test', 'Duration (mins)': 15, questionIds: ['Q0001', 'Q0002', 'Q0003', 'Q0004', 'Q0005'] },
                    { 'Exam Code': 'GK_TEST_01', Title: 'General Knowledge Assessment', 'Duration (mins)': 10, questionIds: ['Q0006', 'Q0007', 'Q0008', 'Q0009', 'Q0010'] },
                    { 'Exam Code': 'REASONING_01', Title: 'Logical Reasoning Test', 'Duration (mins)': 12, questionIds: ['Q0011', 'Q0012', 'Q0013', 'Q0014', 'Q0015'] },
                    { 'Exam Code': 'ENGLISH_01', Title: 'English Language Test', 'Duration (mins)': 10, questionIds: ['Q0016', 'Q0017', 'Q0018', 'Q0019', 'Q0020'] },
                    { 'Exam Code': 'MIXED_TEST_01', Title: 'Mixed Subject Assessment', 'Duration (mins)': 20, questionIds: ['Q0001', 'Q0006', 'Q0011', 'Q0016', 'Q0003', 'Q0008', 'Q0013', 'Q0018', 'Q0005', 'Q0010'] }
                ];

                const createdExams = [];
                for (const exam of SAMPLE_EXAMS) {
                    const questionRecordIds = exam.questionIds.map(qId => questionMap[qId]).filter(id => id);

                    const examData = {
                        'Exam Code': exam['Exam Code'],
                        'Title': exam.Title,
                        'Duration (mins)': exam['Duration (mins)'],
                        'Expiry (IST)': expiryIST,
                        'Question IDs': questionRecordIds
                    };

                    const record = await base(EXAMS_TABLE).create(examData);
                    createdExams.push(record);
                }

                return res.status(201).json({
                    success: true,
                    message: 'Sample exams created successfully',
                    data: {
                        questionsCreated: createdQuestions.length,
                        examsCreated: createdExams.length,
                        exams: SAMPLE_EXAMS.map(e => ({
                            code: e['Exam Code'],
                            title: e.Title,
                            questions: e.questionIds.length
                        }))
                    }
                });

            } catch (error) {
                console.error('Sample creation error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to create sample exams'
                });
            }
        }

        // 404 - Route not found
        return res.status(404).json({
            success: false,
            error: 'Route not found'
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
