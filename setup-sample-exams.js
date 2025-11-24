#!/usr/bin/env node

/**
 * Setup Script for Polite Exam System
 *
 * This script will:
 * 1. Clean up all existing exams from the database
 * 2. Create sample questions if needed
 * 3. Create sample exams for testing
 */

require('dotenv').config();
const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

const QUESTIONS_TABLE = 'Questions';
const EXAMS_TABLE = 'Exams';
const RESULTS_TABLE = 'Results';

// Sample questions for different subjects
const SAMPLE_QUESTIONS = [
    // Math Questions
    {
        ID: 'Q0001',
        Subject: 'Math',
        Question: 'What is 15 × 8?',
        'Option A': '100',
        'Option B': '120',
        'Option C': '140',
        'Option D': '160',
        Correct: 'B'
    },
    {
        ID: 'Q0002',
        Subject: 'Math',
        Question: 'What is the value of √144?',
        'Option A': '10',
        'Option B': '11',
        'Option C': '12',
        'Option D': '13',
        Correct: 'C'
    },
    {
        ID: 'Q0003',
        Subject: 'Math',
        Question: 'What is 25% of 200?',
        'Option A': '25',
        'Option B': '50',
        'Option C': '75',
        'Option D': '100',
        Correct: 'B'
    },
    {
        ID: 'Q0004',
        Subject: 'Math',
        Question: 'If x + 7 = 15, what is the value of x?',
        'Option A': '6',
        'Option B': '7',
        'Option C': '8',
        'Option D': '9',
        Correct: 'C'
    },
    {
        ID: 'Q0005',
        Subject: 'Math',
        Question: 'What is the area of a rectangle with length 12 cm and width 8 cm?',
        'Option A': '20 sq cm',
        'Option B': '40 sq cm',
        'Option C': '96 sq cm',
        'Option D': '120 sq cm',
        Correct: 'C'
    },

    // General Knowledge Questions
    {
        ID: 'Q0006',
        Subject: 'General Knowledge',
        Question: 'What is the capital of India?',
        'Option A': 'New Delhi',
        'Option B': 'Mumbai',
        'Option C': 'Kolkata',
        'Option D': 'Chennai',
        Correct: 'A'
    },
    {
        ID: 'Q0007',
        Subject: 'General Knowledge',
        Question: 'Who is known as the Father of the Nation in India?',
        'Option A': 'Jawaharlal Nehru',
        'Option B': 'Mahatma Gandhi',
        'Option C': 'Subhas Chandra Bose',
        'Option D': 'Sardar Patel',
        Correct: 'B'
    },
    {
        ID: 'Q0008',
        Subject: 'General Knowledge',
        Question: 'Which is the largest planet in our solar system?',
        'Option A': 'Earth',
        'Option B': 'Mars',
        'Option C': 'Jupiter',
        'Option D': 'Saturn',
        Correct: 'C'
    },
    {
        ID: 'Q0009',
        Subject: 'General Knowledge',
        Question: 'How many continents are there in the world?',
        'Option A': '5',
        'Option B': '6',
        'Option C': '7',
        'Option D': '8',
        Correct: 'C'
    },
    {
        ID: 'Q0010',
        Subject: 'General Knowledge',
        Question: 'What is the national animal of India?',
        'Option A': 'Lion',
        'Option B': 'Tiger',
        'Option C': 'Elephant',
        'Option D': 'Peacock',
        Correct: 'B'
    },

    // Reasoning Questions
    {
        ID: 'Q0011',
        Subject: 'Reasoning',
        Question: 'If CAT is coded as 3120, then DOG would be coded as:',
        'Option A': '4157',
        'Option B': '41507',
        'Option C': '4-15-7',
        'Option D': '4-15-07',
        Correct: 'A'
    },
    {
        ID: 'Q0012',
        Subject: 'Reasoning',
        Question: 'Complete the series: 2, 6, 12, 20, 30, ?',
        'Option A': '40',
        'Option B': '42',
        'Option C': '44',
        'Option D': '46',
        Correct: 'B'
    },
    {
        ID: 'Q0013',
        Subject: 'Reasoning',
        Question: 'Which number is the odd one out: 3, 5, 7, 9, 12, 13?',
        'Option A': '3',
        'Option B': '7',
        'Option C': '12',
        'Option D': '13',
        Correct: 'C'
    },
    {
        ID: 'Q0014',
        Subject: 'Reasoning',
        Question: 'If all roses are flowers and all flowers are plants, then:',
        'Option A': 'All plants are roses',
        'Option B': 'All roses are plants',
        'Option C': 'Some plants are flowers',
        'Option D': 'No conclusion',
        Correct: 'B'
    },
    {
        ID: 'Q0015',
        Subject: 'Reasoning',
        Question: 'Find the missing number: 5, 10, 20, 40, ?, 160',
        'Option A': '60',
        'Option B': '70',
        'Option C': '80',
        'Option D': '90',
        Correct: 'C'
    },

    // English Questions
    {
        ID: 'Q0016',
        Subject: 'English',
        Question: 'Choose the correct synonym of "Abundant":',
        'Option A': 'Scarce',
        'Option B': 'Plentiful',
        'Option C': 'Limited',
        'Option D': 'Rare',
        Correct: 'B'
    },
    {
        ID: 'Q0017',
        Subject: 'English',
        Question: 'Identify the correctly spelled word:',
        'Option A': 'Occassion',
        'Option B': 'Occasion',
        'Option C': 'Ocassion',
        'Option D': 'Ocasion',
        Correct: 'B'
    },
    {
        ID: 'Q0018',
        Subject: 'English',
        Question: 'What is the antonym of "Ancient"?',
        'Option A': 'Old',
        'Option B': 'Modern',
        'Option C': 'Historic',
        'Option D': 'Traditional',
        Correct: 'B'
    },
    {
        ID: 'Q0019',
        Subject: 'English',
        Question: 'Choose the correct sentence:',
        'Option A': 'She don\'t like apples',
        'Option B': 'She doesn\'t likes apples',
        'Option C': 'She doesn\'t like apples',
        'Option D': 'She don\'t likes apples',
        Correct: 'C'
    },
    {
        ID: 'Q0020',
        Subject: 'English',
        Question: 'What is the plural of "Child"?',
        'Option A': 'Childs',
        'Option B': 'Childes',
        'Option C': 'Children',
        'Option D': 'Childrens',
        Correct: 'C'
    }
];

// Sample exams to create
const SAMPLE_EXAMS = [
    {
        'Exam Code': 'MATH_BASICS_01',
        Title: 'Basic Mathematics Test',
        'Duration (mins)': 15,
        questionIds: ['Q0001', 'Q0002', 'Q0003', 'Q0004', 'Q0005']
    },
    {
        'Exam Code': 'GK_TEST_01',
        Title: 'General Knowledge Assessment',
        'Duration (mins)': 10,
        questionIds: ['Q0006', 'Q0007', 'Q0008', 'Q0009', 'Q0010']
    },
    {
        'Exam Code': 'REASONING_01',
        Title: 'Logical Reasoning Test',
        'Duration (mins)': 12,
        questionIds: ['Q0011', 'Q0012', 'Q0013', 'Q0014', 'Q0015']
    },
    {
        'Exam Code': 'ENGLISH_01',
        Title: 'English Language Test',
        'Duration (mins)': 10,
        questionIds: ['Q0016', 'Q0017', 'Q0018', 'Q0019', 'Q0020']
    },
    {
        'Exam Code': 'MIXED_TEST_01',
        Title: 'Mixed Subject Assessment',
        'Duration (mins)': 20,
        questionIds: ['Q0001', 'Q0006', 'Q0011', 'Q0016', 'Q0003', 'Q0008', 'Q0013', 'Q0018', 'Q0005', 'Q0010']
    }
];

// Helper function to delete all records from a table
async function cleanTable(tableName) {
    console.log(`\n🧹 Cleaning ${tableName} table...`);

    try {
        const records = await base(tableName).select().all();

        if (records.length === 0) {
            console.log(`   ℹ️  No records found in ${tableName}`);
            return;
        }

        console.log(`   Found ${records.length} records to delete`);

        // Delete in batches of 10 (Airtable limit)
        const batchSize = 10;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const recordIds = batch.map(r => r.id);
            await base(tableName).destroy(recordIds);
            console.log(`   ✅ Deleted ${Math.min(i + batchSize, records.length)}/${records.length} records`);
        }

        console.log(`   ✅ Cleaned ${tableName} successfully!`);
    } catch (error) {
        console.error(`   ❌ Error cleaning ${tableName}:`, error.message);
        throw error;
    }
}

// Create questions
async function createQuestions() {
    console.log('\n📝 Creating sample questions...');

    try {
        // Check if questions already exist
        const existingQuestions = await base(QUESTIONS_TABLE)
            .select({ maxRecords: 1 })
            .all();

        if (existingQuestions.length > 0) {
            console.log('   ℹ️  Questions already exist, skipping creation');
            return;
        }

        // Create questions in batches of 10
        const batchSize = 10;
        const createdRecords = [];

        for (let i = 0; i < SAMPLE_QUESTIONS.length; i += batchSize) {
            const batch = SAMPLE_QUESTIONS.slice(i, i + batchSize);
            const records = await base(QUESTIONS_TABLE).create(
                batch.map(q => ({ fields: q }))
            );
            createdRecords.push(...records);
            console.log(`   ✅ Created ${Math.min(i + batchSize, SAMPLE_QUESTIONS.length)}/${SAMPLE_QUESTIONS.length} questions`);
        }

        console.log(`   ✅ Created ${SAMPLE_QUESTIONS.length} sample questions successfully!`);
        return createdRecords;
    } catch (error) {
        console.error('   ❌ Error creating questions:', error.message);
        throw error;
    }
}

// Get question record IDs by question IDs
async function getQuestionRecordIds(questionIds) {
    const recordIds = [];

    for (const qId of questionIds) {
        const records = await base(QUESTIONS_TABLE)
            .select({
                filterByFormula: `{ID} = '${qId}'`,
                maxRecords: 1
            })
            .all();

        if (records.length > 0) {
            recordIds.push(records[0].id);
        } else {
            console.warn(`   ⚠️  Question ${qId} not found`);
        }
    }

    return recordIds;
}

// Create exams
async function createExams() {
    console.log('\n📋 Creating sample exams...');

    try {
        const createdExams = [];

        for (const exam of SAMPLE_EXAMS) {
            // Get the actual Airtable record IDs for the questions
            const questionRecordIds = await getQuestionRecordIds(exam.questionIds);

            if (questionRecordIds.length !== exam.questionIds.length) {
                console.warn(`   ⚠️  Some questions not found for ${exam['Exam Code']}`);
            }

            // Calculate expiry date (7 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);
            const expiryIST = expiryDate.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            const examData = {
                'Exam Code': exam['Exam Code'],
                'Title': exam.Title,
                'Duration (mins)': exam['Duration (mins)'],
                'Expiry (IST)': expiryIST,
                'Question IDs': questionRecordIds  // Linked records field
            };

            const record = await base(EXAMS_TABLE).create(examData);
            createdExams.push(record);

            console.log(`   ✅ Created exam: ${exam['Exam Code']} - ${exam.Title} (${exam.questionIds.length} questions)`);
        }

        console.log(`   ✅ Created ${createdExams.length} sample exams successfully!`);
        return createdExams;
    } catch (error) {
        console.error('   ❌ Error creating exams:', error.message);
        throw error;
    }
}

// Main setup function
async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   Polite Coaching Centre - Exam Setup Script         ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    try {
        // Step 1: Clean up existing exams and results (keep questions)
        console.log('\n🎯 Step 1: Cleaning up database...');
        await cleanTable(RESULTS_TABLE);
        await cleanTable(EXAMS_TABLE);
        await cleanTable(QUESTIONS_TABLE);

        // Step 2: Create sample questions
        console.log('\n🎯 Step 2: Setting up questions...');
        await createQuestions();

        // Step 3: Create sample exams
        console.log('\n🎯 Step 3: Setting up exams...');
        await createExams();

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║   ✅ Setup completed successfully!                    ║');
        console.log('╚═══════════════════════════════════════════════════════╝');
        console.log('\n📊 Available exams:');
        SAMPLE_EXAMS.forEach(exam => {
            console.log(`   • ${exam['Exam Code']}: ${exam.Title} (${exam.questionIds.length} questions, ${exam['Duration (mins)']} mins)`);
        });
        console.log('\n🎓 You can now test the exam system with these sample exams!');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    }
}

// Run the setup
main();
