// API Integration for Polite Coaching Centre
// This file replaces local data with API calls to the backend

// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api';

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    document.getElementById('notification-container').appendChild(notification);
    
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
        let maxNum = 0;
        existingQuestions.forEach(q => {
            if (q.ID) {
                // Support both old format (q1, q2) and new format (Q0001, Q0002)
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
        const nextId = 'Q' + String(maxNum + 1).padStart(4, '0');

        const response = await fetch(`${API_URL}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ID: nextId,
                Subject: questionData.subject,
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
            console.log('✅ Question added to database');
            showNotification('✅ Question added successfully!', 'success');
            
            // Reload questions
            await loadQuestions();
            return true;
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
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to reset password');
        }
    } catch (error) {
        console.error('❌ Error resetting password:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return null;
    }
}

// Verify database tables
async function verifyTables() {
    try {
        const response = await fetch(`${API_URL}/admin/verify-tables`);
        const data = await response.json();

        if (data.success) {
            console.log('✅ All database tables verified');
            return data.tables;
        } else {
            console.error('❌ Some tables are missing:', data.tables);
            return data.tables;
        }
    } catch (error) {
        console.error('❌ Error verifying tables:', error);
        return null;
    }
}

// Load active exams only
async function loadActiveExams() {
    try {
        const response = await fetch(`${API_URL}/exams/active`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Loaded ${data.count} active exams`);
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to load active exams');
        }
    } catch (error) {
        console.error('❌ Error loading active exams:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return [];
    }
}

// Get attempted exams for a candidate
async function getAttemptedExams(email) {
    try {
        const response = await fetch(`${API_URL}/candidates/${encodeURIComponent(email)}/attempted-exams`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Candidate has attempted ${data.data.attemptedExams.length} exams`);
            return data.data.attemptedExams;
        } else {
            throw new Error(data.error || 'Failed to get attempted exams');
        }
    } catch (error) {
        console.error('❌ Error getting attempted exams:', error);
        return [];
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
    verifyTables,
    loadActiveExams,
    getAttemptedExams
};
