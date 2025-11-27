#!/usr/bin/env node

/**
 * Script to create test candidate account
 * Email: srksourabh@gmail.com
 * Password: soourabh
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const candidateData = {
    name: 'Test Candidate',
    email: 'srksourabh@gmail.com',
    mobile: '9999999999',
    password: 'soourabh'
};

async function createTestCandidate() {
    try {
        console.log('Creating test candidate account...');
        console.log('Email:', candidateData.email);
        console.log('Password:', candidateData.password);

        const response = await fetch(`${API_URL}/auth/candidate/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(candidateData)
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Test candidate account created successfully!');
            console.log('Login credentials:');
            console.log('  Email:', candidateData.email);
            console.log('  Password:', candidateData.password);
        } else {
            console.error('❌ Failed to create account:', data.error);
            if (data.error && data.error.includes('already exists')) {
                console.log('ℹ️  Account already exists. You can use the existing credentials.');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nℹ️  Make sure the API server is running at:', API_URL);
    }
}

createTestCandidate();
