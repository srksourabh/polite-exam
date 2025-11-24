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
            if (q.ID && q.ID.startsWith('q')) {
                const num = parseInt(q.ID.substring(1));
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        const nextId = 'q' + (maxNum + 1);

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

// Initialize on page load - ONLY check connection, don't load data yet
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 API integration ready');
    
    // We'll check connection and load data ONLY when user logs in as admin
    // This prevents errors when testing locally or before deployment
    console.log('✅ Login buttons are ready to use');
    console.log('💡 Data will load when you access admin panel');
});

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
    showNotification
};
