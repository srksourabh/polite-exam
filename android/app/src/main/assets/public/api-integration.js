// API Integration for Polite Coaching Centre
// This file replaces local data with API calls to the backend

// API Configuration
const VERCEL_API_URL = 'https://polite-exam.vercel.app/api';

// Determine API URL based on environment
const API_URL = (() => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    console.log('🔍 Environment:', { protocol, hostname, port, capacitor: typeof window.Capacitor });

    // Running on Vercel production - use relative path
    if (hostname === 'polite-exam.vercel.app' || hostname.endsWith('.vercel.app')) {
        console.log('🌐 Vercel web - using /api');
        return '/api';
    }

    // Running on localhost WITH a port (local development server)
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '') {
        console.log('🔧 Local dev server - using localhost:3000/api');
        return 'http://localhost:3000/api';
    }

    // Everything else (Capacitor app, file://, etc.) - use Vercel API
    console.log('📱 Mobile app or other - using Vercel API');
    return VERCEL_API_URL;
})();

console.log('✅ API URL:', API_URL);

// =====================================================
// SECURITY: HTML Sanitization to prevent XSS attacks
// =====================================================

// Escape HTML special characters to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Sanitize object properties recursively (for data from API)
function sanitizeData(data) {
    if (typeof data === 'string') {
        return escapeHtml(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }
    if (data && typeof data === 'object') {
        const sanitized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeData(data[key]);
            }
        }
        return sanitized;
    }
    return data;
}

// Safe innerHTML setter that escapes content
function safeSetInnerHTML(element, html, allowBasicHTML = false) {
    if (!element) return;
    if (allowBasicHTML) {
        // Allow only specific safe HTML tags
        const safeTags = ['b', 'i', 'strong', 'em', 'br', 'p', 'span'];
        let sanitized = escapeHtml(html);
        // Restore safe tags
        safeTags.forEach(tag => {
            const openRegex = new RegExp(`&lt;${tag}&gt;`, 'gi');
            const closeRegex = new RegExp(`&lt;/${tag}&gt;`, 'gi');
            sanitized = sanitized.replace(openRegex, `<${tag}>`);
            sanitized = sanitized.replace(closeRegex, `</${tag}>`);
        });
        element.innerHTML = sanitized;
    } else {
        element.textContent = html;
    }
}

// =====================================================
// Helper function to show notifications
// =====================================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    // Use textContent to prevent XSS
    notification.textContent = message;
    const container = document.getElementById('notification-container');
    if (container) {
        container.appendChild(notification);
    }

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Global variables
let questions = [];
let exams = [];
let questionCounter = 1;

// Load questions from database
async function loadQuestions() {
    try {
        const response = await fetch(`${API_URL}/questions`);
        const data = await response.json();

        if (data.success) {
            questions = data.data || data.questions || [];
            console.log(`✅ Loaded ${questions.length} questions from database`);
            return questions;
        } else {
            throw new Error(data.error || 'Failed to load questions');
        }
    } catch (error) {
        console.error('❌ Error loading questions:', error);
        showNotification('❌ Failed to load questions from database', 'error');
        return [];
    }
}

// Load exams from database
async function loadExams() {
    try {
        const response = await fetch(`${API_URL}/exams`);
        const data = await response.json();

        if (data.success) {
            exams = data.data || data.exams || [];
            console.log(`✅ Loaded ${exams.length} exams from database`);
            return exams;
        } else {
            throw new Error(data.error || 'Failed to load exams');
        }
    } catch (error) {
        console.error('❌ Error loading exams:', error);
        showNotification('❌ Failed to load exams from database', 'error');
        return [];
    }
}

// Add question to database
async function addQuestionToDatabase(questionData) {
    try {
        // First, get all existing questions to determine the next ID
        const existingQuestions = await loadQuestions();

        // Check if this is a child question (has Parent Question set)
        const isChildQuestion = questionData['Parent Question'] && questionData['Parent Question'].length > 0;

        let nextId;

        if (isChildQuestion) {
            // For child questions, use parent's ID with suffix (Q0508.1, Q0508.2, etc.)
            const parentRecordId = questionData['Parent Question'][0];
            const parentQuestion = existingQuestions.find(q => q.id === parentRecordId);

            if (parentQuestion && parentQuestion.ID) {
                const parentDisplayId = parentQuestion.ID; // e.g., Q0508

                // Count existing children of this parent to determine the suffix
                const existingChildren = existingQuestions.filter(q => {
                    return q['Parent Question'] &&
                           q['Parent Question'].length > 0 &&
                           q['Parent Question'][0] === parentRecordId;
                });

                const childNumber = existingChildren.length + 1;
                nextId = `${parentDisplayId}.${childNumber}`; // e.g., Q0508.1, Q0508.2

                console.log(`📝 Generating child ID: ${nextId} (parent: ${parentDisplayId}, child #${childNumber})`);
            } else {
                // Fallback: if parent not found, use a temporary ID
                console.warn('⚠️ Parent question not found for child, using fallback ID');
                nextId = 'Q-CHILD-' + Date.now();
            }
        } else {
            // For parent and standalone questions, generate new sequential ID
            let maxNum = 0;
            existingQuestions.forEach(q => {
                if (q.ID) {
                    // Support both old format (q1, q2) and new format (Q0001, Q0002)
                    // Only count main IDs, not child IDs (Q0508.1)
                    const match = q.ID.match(/^[qQ](\d+)$/);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                }
            });
            // Generate new ID in Q0001 format (4 digits with leading zeros)
            nextId = 'Q' + String(maxNum + 1).padStart(4, '0');
            console.log(`📝 Generating parent/standalone ID: ${nextId}`);
        }

        // Build question payload
        const payload = {
            ID: nextId,
            Subject: questionData.subject || questionData.Subject,
            Difficulty: questionData.difficulty || questionData.Difficulty || 'Medium',
            Question: questionData.question || questionData.Question
        };

        // Check if this is a parent question (passage) - no options needed
        const isParentQuestion = (questionData['Question Type'] === 'Parent-child' && !questionData['Parent Question']) ||
                                questionData.isMainQuestion ||
                                questionData['Main Question Text'];

        // Add options only for non-parent questions (children and standalone)
        if (!isParentQuestion) {
            // Support both array format (options[]) and individual format (optionA, optionB, etc.)
            const optA = questionData.optionA || questionData['Option A'] || (questionData.options && questionData.options[0]) || '';
            const optB = questionData.optionB || questionData['Option B'] || (questionData.options && questionData.options[1]) || '';
            const optC = questionData.optionC || questionData['Option C'] || (questionData.options && questionData.options[2]) || '';
            const optD = questionData.optionD || questionData['Option D'] || (questionData.options && questionData.options[3]) || '';

            payload['Option A'] = optA;
            payload['Option B'] = optB;
            payload['Option C'] = optC;
            payload['Option D'] = optD;
            payload['Correct'] = questionData.correct || questionData.Correct || '';

            console.log('📝 Adding question with options:', { optA, optB, optC, optD, correct: questionData.correct });
        }

        // Handle NEW hierarchical fields (Question Type, Parent Question, Sub Question Number, Main Question Text)
        if (questionData['Question Type']) {
            payload['Question Type'] = questionData['Question Type'];
        }

        if (questionData['Parent Question']) {
            payload['Parent Question'] = questionData['Parent Question']; // Array of record IDs
        }

        if (questionData['Sub Question Number']) {
            payload['Sub Question Number'] = questionData['Sub Question Number'];
        }

        if (questionData['Main Question Text']) {
            payload['Main Question Text'] = questionData['Main Question Text'];
        }

        // Handle OLD hierarchical fields for backward compatibility
        if (questionData.isSubQuestion) {
            payload['Question Type'] = 'Parent-child';
            // Old format used Parent Question ID (string), new format uses Parent Question (array)
            if (questionData.parentQuestionId && !payload['Parent Question']) {
                // Need to find the record ID for this display ID
                const parentQ = existingQuestions.find(q => q.ID === questionData.parentQuestionId);
                if (parentQ && parentQ.id) {
                    payload['Parent Question'] = [parentQ.id];
                }
            }
            payload['Sub Question Number'] = questionData.subQuestionOrder || 1;
        }

        if (questionData.isMainQuestion) {
            payload['Question Type'] = 'Parent-child';
            payload['Main Question Text'] = questionData.question || questionData.Question;
        }

        console.log('📤 Sending question payload:', payload);

        const response = await fetch(`${API_URL}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Question added to database:', data.data);
            showNotification('✅ Question added successfully!', 'success');

            // Reload questions
            await loadQuestions();
            // Return the full question data including the record ID
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to add question');
        }
    } catch (error) {
        console.error('❌ Error adding question:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return false;
    }
}

// Update question in database
async function updateQuestionInDatabase(questionId, questionData) {
    try {
        const response = await fetch(`${API_URL}/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Subject: questionData.subject,
                Difficulty: questionData.difficulty || 'Medium',
                Question: questionData.question,
                'Option A': questionData.optionA,
                'Option B': questionData.optionB,
                'Option C': questionData.optionC,
                'Option D': questionData.optionD,
                Correct: questionData.correct
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Question updated in database');
            showNotification('✅ Question updated successfully!', 'success');

            // Reload questions
            await loadQuestions();
            return true;
        } else {
            throw new Error(data.error || 'Failed to update question');
        }
    } catch (error) {
        console.error('❌ Error updating question:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return false;
    }
}

// Create exam in database
async function createExamInDatabase(examData) {
    try {
        const response = await fetch(`${API_URL}/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(examData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Exam created in database');
            showNotification(`✅ Exam "${examData['Exam Code']}" created successfully!`, 'success');

            // Reload exams
            await loadExams();
            return true;
        } else {
            throw new Error(data.error || 'Failed to create exam');
        }
    } catch (error) {
        console.error('❌ Error creating exam:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return false;
    }
}

// Get exam by code
async function getExamByCode(examCode) {
    try {
        const response = await fetch(`${API_URL}/exams/${examCode}`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Loaded exam: ${examCode}`);
            return data.data || data.exam;
        } else {
            throw new Error(data.error || 'Exam not found');
        }
    } catch (error) {
        console.error('❌ Error loading exam:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Submit result to database
async function submitResultToDatabase(resultData) {
    try {
        const response = await fetch(`${API_URL}/results`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resultData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Result submitted to database');
            showNotification('✅ Result saved successfully!', 'success');
            return true;
        } else {
            throw new Error(data.error || 'Failed to submit result');
        }
    } catch (error) {
        console.error('❌ Error submitting result:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return false;
    }
}

// Get results for an exam
async function getExamResults(examCode) {
    try {
        const response = await fetch(`${API_URL}/results/${examCode}`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Loaded results for: ${examCode}`);
            return data.data || data.results || [];
        } else {
            throw new Error(data.error || 'Failed to load results');
        }
    } catch (error) {
        console.error('❌ Error loading results:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return [];
    }
}

// Check all system services status
async function checkSystemStatus() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'ok' && data.services) {
            // Update Airtable status
            const dbStatusItem = document.getElementById('db-status-item');
            const dbStatusText = document.getElementById('db-status-text');
            if (data.services.airtable.status === 'connected') {
                if (dbStatusItem) dbStatusItem.classList.remove('status-bad');
                if (dbStatusText) dbStatusText.textContent = '✅ Connected';
            } else {
                if (dbStatusItem) dbStatusItem.classList.add('status-bad');
                if (dbStatusText) dbStatusText.textContent = '❌ Error';
            }
            
            // Update Gemini AI status
            const geminiStatusItem = document.getElementById('gemini-status-item');
            const geminiStatusText = document.getElementById('gemini-status-text');
            if (data.services.gemini.status === 'connected') {
                if (geminiStatusItem) geminiStatusItem.classList.remove('status-bad');
                if (geminiStatusText) geminiStatusText.textContent = '✅ Active';
            } else {
                if (geminiStatusItem) geminiStatusItem.classList.add('status-bad');
                if (geminiStatusText) geminiStatusText.textContent = '⚠️ Not Configured';
            }
            
            // Update OCR status
            const ocrStatusItem = document.getElementById('ocr-status-item');
            const ocrStatusText = document.getElementById('ocr-status-text');
            if (data.services.ocr.status === 'connected') {
                if (ocrStatusItem) ocrStatusItem.classList.remove('status-bad');
                if (ocrStatusText) ocrStatusText.textContent = '✅ Ready';
            } else {
                if (ocrStatusItem) ocrStatusItem.classList.add('status-bad');
                if (ocrStatusText) ocrStatusText.textContent = '⚠️ Not Configured';
            }
            
            console.log('✅ System status updated:', data.services);
            return true;
        } else {
            throw new Error('Failed to get system status');
        }
    } catch (error) {
        const dbStatusItem = document.getElementById('db-status-item');
        const dbStatusText = document.getElementById('db-status-text');
        const geminiStatusItem = document.getElementById('gemini-status-item');
        const geminiStatusText = document.getElementById('gemini-status-text');
        const ocrStatusItem = document.getElementById('ocr-status-item');
        const ocrStatusText = document.getElementById('ocr-status-text');
        
        if (dbStatusItem) dbStatusItem.classList.add('status-bad');
        if (dbStatusText) dbStatusText.textContent = '❌ Offline';
        if (geminiStatusItem) geminiStatusItem.classList.add('status-bad');
        if (geminiStatusText) geminiStatusText.textContent = '❌ Offline';
        if (ocrStatusItem) ocrStatusItem.classList.add('status-bad');
        if (ocrStatusText) ocrStatusText.textContent = '❌ Offline';
        
        console.error('❌ Cannot reach backend server:', error);
        return false;
    }
}

// Legacy function name for compatibility
async function checkDatabaseConnection() {
    return await checkSystemStatus();
}

// Delete question from database
async function deleteQuestionFromDatabase(questionId) {
    try {
        const response = await fetch(`${API_URL}/questions/${questionId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Question ${questionId} deleted successfully`);
            showNotification('✅ Question deleted successfully!', 'success');
            return true;
        } else {
            throw new Error(data.error || 'Failed to delete question');
        }
    } catch (error) {
        console.error('❌ Error deleting question:', error);
        showNotification('❌ Failed to delete question', 'error');
        return false;
    }
}

// Migrate all questions to new ID format (Q0001, Q0002, etc.)
async function migrateQuestionsToNewFormat() {
    try {
        showNotification('🔄 Starting migration to new question format...', 'info');

        const response = await fetch(`${API_URL}/questions/migrate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Successfully migrated ${data.count} questions`);
            showNotification(`✅ ${data.message}`, 'success');

            // Reload questions to see the new IDs
            await loadQuestions();
            return true;
        } else {
            throw new Error(data.error || 'Failed to migrate questions');
        }
    } catch (error) {
        console.error('❌ Error migrating questions:', error);
        showNotification(`❌ Migration failed: ${error.message}`, 'error');
        return false;
    }
}

// Create sample exams with questions
async function createSampleExams() {
    try {
        showNotification('🔄 Creating sample exams...', 'info');

        const response = await fetch(`${API_URL}/admin/create-sample-exams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            console.log(`✅ Created: ${data.data.questionsCreated} questions, ${data.data.examsCreated} exams`);

            // Show detailed info
            let examsList = data.data.exams.map(e => `${e.code}: ${e.title} (${e.questions} questions)`).join('\n');
            showNotification(`✅ ${data.message}\n\nExams created:\n${examsList}`, 'success');

            // Reload questions and exams
            await loadQuestions();
            await loadExams();
            return true;
        } else {
            throw new Error(data.error || 'Failed to create sample exams');
        }
    } catch (error) {
        console.error('❌ Error creating sample exams:', error);
        showNotification(`❌ Failed to create sample exams: ${error.message}`, 'error');
        return false;
    }
}

// Initialize on page load - ONLY check connection, don't load data yet
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 API integration ready');

    // We'll check connection and load data ONLY when user logs in as admin
    // This prevents errors when testing locally or before deployment
    console.log('✅ Login buttons are ready to use');
    console.log('💡 Data will load when you access admin panel');
});

// Candidate signup
async function candidateSignup(signupData) {
    try {
        const response = await fetch(`${API_URL}/auth/candidate/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signupData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Account created successfully');
            showNotification('✅ Account created! Please login.', 'success');
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to create account');
        }
    } catch (error) {
        console.error('❌ Error creating account:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Candidate login
async function candidateLogin(email, password) {
    try {
        const response = await fetch(`${API_URL}/auth/candidate/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Login successful');
            showNotification('✅ Welcome back!', 'success');
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to login');
        }
    } catch (error) {
        console.error('❌ Error logging in:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Admin login
async function adminLogin(username, password) {
    try {
        const response = await fetch(`${API_URL}/auth/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Admin login successful');
            showNotification('✅ Welcome Admin!', 'success');
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to login');
        }
    } catch (error) {
        console.error('❌ Error logging in:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Get candidate profile
async function getCandidateProfile(email) {
    try {
        const response = await fetch(`${API_URL}/candidates/profile/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.success) {
            console.log('✅ Profile loaded');
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to load profile');
        }
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Get candidate exam history
async function getCandidateExamHistory(email) {
    try {
        const response = await fetch(`${API_URL}/candidates/exams/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Loaded ${data.data.examsGiven} exam records`);
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to load exam history');
        }
    } catch (error) {
        console.error('❌ Error loading exam history:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Reset password
async function resetPassword(email) {
    try {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Password reset successful');
            return {
                success: true,
                message: data.message,
                tempPassword: data.data?.tempPassword // Only in dev mode
            };
        } else {
            throw new Error(data.error || 'Failed to reset password');
        }
    } catch (error) {
        console.error('❌ Error resetting password:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Verify email
async function verifyEmail(token) {
    try {
        const response = await fetch(`${API_URL}/auth/verify/${token}`);
        const data = await response.json();

        if (data.success) {
            console.log('✅ Email verified successfully');
            showNotification('✅ Email verified! You can now login.', 'success');
            return data;
        } else {
            throw new Error(data.error || 'Failed to verify email');
        }
    } catch (error) {
        console.error('❌ Error verifying email:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Resend verification email
async function resendVerification(email) {
    try {
        const response = await fetch(`${API_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Verification email sent');
            showNotification('✅ Verification email sent. Please check your inbox.', 'success');
            return data;
        } else {
            throw new Error(data.error || 'Failed to send verification email');
        }
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Update candidate profile
async function updateCandidateProfile(profileData) {
    try {
        const response = await fetch(`${API_URL}/candidates/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Profile updated successfully');
            showNotification('✅ Profile updated successfully!', 'success');
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Change candidate password
async function changePassword(email, currentPassword, newPassword) {
    try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, currentPassword, newPassword })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Password changed successfully');
            showNotification('✅ Password changed successfully!', 'success');
            return true;
        } else {
            throw new Error(data.error || 'Failed to change password');
        }
    } catch (error) {
        console.error('❌ Error changing password:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return false;
    }
}

// Export functions for use in main script
window.PoliteCCAPI = {
    loadQuestions,
    loadExams,
    addQuestionToDatabase,
    createExamInDatabase,
    getExamByCode,
    submitResultToDatabase,
    getExamResults,
    checkDatabaseConnection,
    checkSystemStatus,
    deleteQuestionFromDatabase,
    migrateQuestionsToNewFormat,
    createSampleExams,
    showNotification,
    candidateSignup,
    candidateLogin,
    adminLogin,
    getCandidateProfile,
    getCandidateExamHistory,
    resetPassword,
    verifyEmail,
    resendVerification,
    updateCandidateProfile,
    changePassword,
    // Security utilities
    escapeHtml,
    sanitizeData,
    safeSetInnerHTML
};
