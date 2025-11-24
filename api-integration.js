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
            questions = data.questions;
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
            exams = data.exams;
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
        const response = await fetch(`${API_URL}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ID: `Q${Date.now()}`,
                Subject: questionData.subject,
                Question: questionData.question,
                OptionA: questionData.optionA,
                OptionB: questionData.optionB,
                OptionC: questionData.optionC,
                OptionD: questionData.optionD,
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

// Create exam in database
async function createExamInDatabase(examData) {
    try {
        const response = await fetch(`${API_URL}/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                examCode: examData.examCode,
                title: examData.title,
                duration: examData.duration,
                expiry: examData.expiry,
                questionIds: examData.questionIds
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Exam created in database');
            showNotification(`✅ Exam "${examData.examCode}" created successfully!`, 'success');
            
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
            return data.exam;
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
            body: JSON.stringify({
                examCode: resultData.examCode,
                name: resultData.name,
                mobile: resultData.mobile,
                score: resultData.score,
                answers: resultData.answers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Result submitted to database');
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
            return data.results;
        } else {
            throw new Error(data.error || 'Failed to load results');
        }
    } catch (error) {
        console.error('❌ Error loading results:', error);
        showNotification(`❌ ${error.message}`, 'error');
        return [];
    }
}

// Check database connection
async function checkDatabaseConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        const dbStatusItem = document.getElementById('db-status-item');
        const dbStatusText = document.getElementById('db-status-text');
        
        if (data.success) {
            if (dbStatusItem) dbStatusItem.classList.remove('status-bad');
            if (dbStatusText) dbStatusText.textContent = '✅ Connected';
            console.log('✅ Database connection healthy');
            return true;
        } else {
            if (dbStatusItem) dbStatusItem.classList.add('status-bad');
            if (dbStatusText) dbStatusText.textContent = '❌ Error';
            console.error('❌ Database connection failed');
            return false;
        }
    } catch (error) {
        const dbStatusItem = document.getElementById('db-status-item');
        const dbStatusText = document.getElementById('db-status-text');
        
        if (dbStatusItem) dbStatusItem.classList.add('status-bad');
        if (dbStatusText) dbStatusText.textContent = '❌ Offline';
        console.error('❌ Cannot reach backend server:', error);
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
    showNotification
};
