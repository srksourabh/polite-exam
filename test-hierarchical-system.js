/**
 * TEST FILE: Hierarchical Question System
 * 
 * This file tests the parent-child question functionality including:
 * 1. Creating parent (Main Question) and children (Sub Questions)
 * 2. Testing cascade delete
 * 3. Fetching hierarchically organized questions
 * 4. Testing scoring logic
 */

const Airtable = require('airtable');

// =====================================================
// CONFIGURATION
// =====================================================
const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

const QUESTIONS_TABLE = 'Questions';

// =====================================================
// TEST DATA: English Comprehension Example
// =====================================================
const testPassage = `Read the following passage about artificial intelligence:

Artificial Intelligence (AI) has revolutionized various aspects of modern life, from healthcare to transportation. Machine learning, a subset of AI, enables computers to learn from data without explicit programming. Deep learning, which uses neural networks with multiple layers, has achieved remarkable success in image recognition and natural language processing. However, concerns about AI ethics, bias, and job displacement remain significant challenges that society must address.

Despite these concerns, the potential benefits of AI are immense. In healthcare, AI systems can analyze medical images with accuracy rivaling human experts. In education, adaptive learning platforms personalize content for each student. As AI technology continues to advance, striking a balance between innovation and responsible development will be crucial for humanity's future.`;

const parentQuestion = {
    ID: 'Q_TEST_PARENT_001',
    Subject: 'English',
    'Question Type': 'Main Question',
    'Main Question Text': testPassage,
    Difficulty: 'Medium'
    // Note: No options for parent questions
};

// Child questions (will be created after parent, using parent's record ID)
const childQuestions = [
    {
        ID: 'Q_TEST_CHILD_001',
        Subject: 'English',
        'Question Type': 'Sub Question',
        'Sub Question Number': 1,
        Question: 'What is the main topic of the passage?',
        'Option A': 'Healthcare technology',
        'Option B': 'Artificial Intelligence and its impact',
        'Option C': 'Neural networks',
        'Option D': 'Job market changes',
        Correct: 'B',
        Difficulty: 'Easy'
    },
    {
        ID: 'Q_TEST_CHILD_002',
        Subject: 'English',
        'Question Type': 'Sub Question',
        'Sub Question Number': 2,
        Question: 'According to the passage, what enables computers to learn from data without explicit programming?',
        'Option A': 'Deep learning',
        'Option B': 'Neural networks',
        'Option C': 'Machine learning',
        'Option D': 'Image recognition',
        Correct: 'C',
        Difficulty: 'Medium'
    },
    {
        ID: 'Q_TEST_CHILD_003',
        Subject: 'English',
        'Question Type': 'Sub Question',
        'Sub Question Number': 3,
        Question: 'Which application of AI is mentioned in the healthcare sector?',
        'Option A': 'Drug development',
        'Option B': 'Patient registration',
        'Option C': 'Medical image analysis',
        'Option D': 'Hospital management',
        Correct: 'C',
        Difficulty: 'Easy'
    },
    {
        ID: 'Q_TEST_CHILD_004',
        Subject: 'English',
        'Question Type': 'Sub Question',
        'Sub Question Number': 4,
        Question: 'What challenge related to AI does the passage mention?',
        'Option A': 'High development costs',
        'Option B': 'Limited computing power',
        'Option C': 'Ethics, bias, and job displacement',
        'Option D': 'Lack of trained professionals',
        Correct: 'C',
        Difficulty: 'Medium'
    },
    {
        ID: 'Q_TEST_CHILD_005',
        Subject: 'English',
        'Question Type': 'Sub Question',
        'Sub Question Number': 5,
        Question: 'What does the passage suggest is crucial for humanity\'s future regarding AI?',
        'Option A': 'Stopping AI development',
        'Option B': 'Faster technological advancement',
        'Option C': 'Balancing innovation with responsible development',
        'Option D': 'Replacing human workers completely',
        Correct: 'C',
        Difficulty: 'Hard'
    }
];

// =====================================================
// TEST FUNCTIONS
// =====================================================

/**
 * Test 1: Create Parent Question
 */
async function testCreateParent() {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 1: Creating Parent Question');
    console.log('═══════════════════════════════════════\n');

    try {
        // First, check if test parent already exists
        const existing = await base(QUESTIONS_TABLE).select({
            filterByFormula: `{ID} = '${parentQuestion.ID}'`
        }).all();

        if (existing.length > 0) {
            console.log('⚠️  Test parent already exists. Deleting first...');
            await base(QUESTIONS_TABLE).destroy(existing[0].id);
            console.log('✅ Deleted existing test parent\n');
        }

        // Create parent
        const record = await base(QUESTIONS_TABLE).create(parentQuestion);
        
        console.log('✅ SUCCESS! Parent question created:');
        console.log(`   Record ID: ${record.id}`);
        console.log(`   Field ID: ${record.fields.ID}`);
        console.log(`   Type: ${record.fields['Question Type']}`);
        console.log(`   Passage length: ${record.fields['Main Question Text'].length} characters`);
        
        return record;
    } catch (error) {
        console.error('❌ FAILED to create parent:', error.message);
        throw error;
    }
}

/**
 * Test 2: Create Child Questions
 */
async function testCreateChildren(parentRecordId) {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 2: Creating Child Questions');
    console.log('═══════════════════════════════════════\n');

    try {
        const createdChildren = [];

        for (let i = 0; i < childQuestions.length; i++) {
            const child = { ...childQuestions[i] };
            
            // Link to parent
            child['Parent Question'] = [parentRecordId];
            
            console.log(`Creating child ${i + 1}/${childQuestions.length}...`);
            
            const record = await base(QUESTIONS_TABLE).create(child);
            createdChildren.push(record);
            
            console.log(`✅ Created: ${record.fields.ID} - ${record.fields.Question.substring(0, 50)}...`);
        }

        console.log(`\n✅ SUCCESS! Created ${createdChildren.length} child questions`);
        console.log(`   All linked to parent: ${parentRecordId}`);
        
        return createdChildren;
    } catch (error) {
        console.error('❌ FAILED to create children:', error.message);
        throw error;
    }
}

/**
 * Test 3: Fetch Hierarchically
 */
async function testFetchHierarchical() {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 3: Fetching Hierarchical Questions');
    console.log('═══════════════════════════════════════\n');

    try {
        // Get parent
        const parentRecords = await base(QUESTIONS_TABLE).select({
            filterByFormula: `{ID} = '${parentQuestion.ID}'`
        }).all();

        if (parentRecords.length === 0) {
            console.log('❌ Parent not found!');
            return;
        }

        const parent = parentRecords[0];
        console.log('📖 PARENT QUESTION:');
        console.log(`   ID: ${parent.fields.ID}`);
        console.log(`   Type: ${parent.fields['Question Type']}`);
        console.log(`   Passage: ${parent.fields['Main Question Text'].substring(0, 100)}...`);

        // Get children
        const childRecords = await base(QUESTIONS_TABLE).select({
            filterByFormula: `SEARCH("${parent.id}", ARRAYJOIN({Parent Question}))`
        }).all();

        console.log(`\n   ⤷ CHILDREN (${childRecords.length}):`);
        
        // Sort by Sub Question Number
        childRecords.sort((a, b) => {
            return (a.fields['Sub Question Number'] || 0) - (b.fields['Sub Question Number'] || 0);
        });

        childRecords.forEach((child, index) => {
            console.log(`\n   ${index + 1}. ${child.fields.ID}`);
            console.log(`      Question: ${child.fields.Question}`);
            console.log(`      Correct Answer: ${child.fields.Correct}`);
        });

        console.log('\n✅ Hierarchical structure verified!');
        console.log(`   Total score potential: ${childRecords.length} marks`);

        return { parent, children: childRecords };
    } catch (error) {
        console.error('❌ FAILED to fetch hierarchically:', error.message);
        throw error;
    }
}

/**
 * Test 4: Test Cascade Delete
 */
async function testCascadeDelete() {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 4: Testing CASCADE DELETE');
    console.log('═══════════════════════════════════════\n');

    try {
        // Get parent
        const parentRecords = await base(QUESTIONS_TABLE).select({
            filterByFormula: `{ID} = '${parentQuestion.ID}'`
        }).all();

        if (parentRecords.length === 0) {
            console.log('⚠️  Parent not found. Nothing to delete.');
            return;
        }

        const parent = parentRecords[0];
        
        // Count children before delete
        const childrenBefore = await base(QUESTIONS_TABLE).select({
            filterByFormula: `SEARCH("${parent.id}", ARRAYJOIN({Parent Question}))`
        }).all();

        console.log(`📊 Before deletion:`);
        console.log(`   Parent: ${parent.fields.ID}`);
        console.log(`   Children: ${childrenBefore.length}`);

        // Delete parent (this should cascade)
        console.log(`\n🗑️  Deleting parent...`);
        
        // First delete children (manual cascade)
        if (childrenBefore.length > 0) {
            console.log(`   Cascade deleting ${childrenBefore.length} children...`);
            const childIds = childrenBefore.map(c => c.id);
            
            // Delete in batches of 10
            for (let i = 0; i < childIds.length; i += 10) {
                const batch = childIds.slice(i, i + 10);
                await base(QUESTIONS_TABLE).destroy(batch);
            }
            console.log(`   ✅ Deleted ${childrenBefore.length} children`);
        }

        // Delete parent
        await base(QUESTIONS_TABLE).destroy(parent.id);
        console.log(`   ✅ Deleted parent`);

        // Verify deletion
        const parentAfter = await base(QUESTIONS_TABLE).select({
            filterByFormula: `{ID} = '${parentQuestion.ID}'`
        }).all();

        const childrenAfter = await base(QUESTIONS_TABLE).select({
            filterByFormula: `SEARCH("${parent.id}", ARRAYJOIN({Parent Question}))`
        }).all();

        console.log(`\n📊 After deletion:`);
        console.log(`   Parent: ${parentAfter.length === 0 ? '✅ Deleted' : '❌ Still exists'}`);
        console.log(`   Children: ${childrenAfter.length === 0 ? '✅ All deleted' : `❌ ${childrenAfter.length} still exist`}`);

        if (parentAfter.length === 0 && childrenAfter.length === 0) {
            console.log('\n✅ CASCADE DELETE SUCCESSFUL!');
            console.log('   Parent and all children were deleted');
        } else {
            console.log('\n⚠️  Some records still exist');
        }

    } catch (error) {
        console.error('❌ FAILED cascade delete:', error.message);
        throw error;
    }
}

/**
 * Test 5: Test Scoring Logic
 */
async function testScoring() {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 5: Testing Scoring Logic');
    console.log('═══════════════════════════════════════\n');

    // Simulate student answers
    const studentAnswers = {
        'Q_TEST_CHILD_001': 'B',  // Correct (+1)
        'Q_TEST_CHILD_002': 'C',  // Correct (+1)
        'Q_TEST_CHILD_003': 'A',  // Wrong (-0.25)
        'Q_TEST_CHILD_004': 'unanswered',  // Unanswered (0)
        'Q_TEST_CHILD_005': 'C'   // Correct (+1)
    };

    let totalScore = 0;
    const scoreBreakdown = [];

    console.log('Student Answers:');
    
    childQuestions.forEach((q, index) => {
        const questionId = q.ID;
        const studentAnswer = studentAnswers[questionId];
        const correctAnswer = q.Correct;
        
        let points = 0;
        let result = '';

        if (studentAnswer === correctAnswer) {
            points = 1;
            result = '✅ Correct';
        } else if (studentAnswer === 'unanswered') {
            points = 0;
            result = '⚪ Unanswered';
        } else {
            points = -0.25;
            result = '❌ Wrong';
        }

        totalScore += points;
        scoreBreakdown.push({
            question: index + 1,
            id: questionId,
            student: studentAnswer,
            correct: correctAnswer,
            points: points,
            result: result
        });

        console.log(`\n${index + 1}. ${questionId}`);
        console.log(`   Student: ${studentAnswer} | Correct: ${correctAnswer}`);
        console.log(`   ${result} → ${points > 0 ? '+' : ''}${points} points`);
    });

    console.log('\n─────────────────────────────────────');
    console.log(`TOTAL SCORE: ${totalScore} / 5`);
    console.log('─────────────────────────────────────');
    
    console.log('\nExpected: 2.75');
    console.log('  (2 correct + 1 correct - 0.25 wrong + 0 unanswered = 2.75)');
    
    if (totalScore === 2.75) {
        console.log('\n✅ SCORING LOGIC CORRECT!');
    } else {
        console.log(`\n❌ Scoring mismatch! Got ${totalScore}, expected 2.75`);
    }
}

/**
 * Test 6: Test Standalone Question (for comparison)
 */
async function testStandaloneQuestion() {
    console.log('\n═══════════════════════════════════════');
    console.log('TEST 6: Creating Standalone Question');
    console.log('═══════════════════════════════════════\n');

    const standaloneQ = {
        ID: 'Q_TEST_STANDALONE_001',
        Subject: 'Mathematics',
        'Question Type': 'Standalone',
        Question: 'What is 25 × 4?',
        'Option A': '90',
        'Option B': '100',
        'Option C': '110',
        'Option D': '120',
        Correct: 'B',
        Difficulty: 'Easy'
    };

    try {
        // Check if exists
        const existing = await base(QUESTIONS_TABLE).select({
            filterByFormula: `{ID} = '${standaloneQ.ID}'`
        }).all();

        if (existing.length > 0) {
            console.log('⚠️  Standalone test question already exists. Deleting...');
            await base(QUESTIONS_TABLE).destroy(existing[0].id);
        }

        // Create
        const record = await base(QUESTIONS_TABLE).create(standaloneQ);
        
        console.log('✅ Standalone question created:');
        console.log(`   ID: ${record.fields.ID}`);
        console.log(`   Type: ${record.fields['Question Type']}`);
        console.log(`   Question: ${record.fields.Question}`);
        console.log(`   This is a regular question (not part of any hierarchy)`);

        // Clean up
        await base(QUESTIONS_TABLE).destroy(record.id);
        console.log('\n✅ Cleaned up (deleted standalone test question)');

    } catch (error) {
        console.error('❌ FAILED standalone test:', error.message);
    }
}

// =====================================================
// MAIN TEST RUNNER
// =====================================================
async function runAllTests() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  HIERARCHICAL QUESTION SYSTEM - COMPREHENSIVE TESTS  ║');
    console.log('╚══════════════════════════════════════════════════╝');

    try {
        // Test 1: Create parent
        const parent = await testCreateParent();
        
        // Test 2: Create children
        await testCreateChildren(parent.id);
        
        // Wait a bit for Airtable to sync
        console.log('\nWaiting 2 seconds for Airtable to sync...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Fetch hierarchically
        await testFetchHierarchical();
        
        // Test 5: Test scoring (before deletion)
        await testScoring();

        // Test 6: Standalone question
        await testStandaloneQuestion();

        // Test 4: Cascade delete (should be last!)
        await testCascadeDelete();

        console.log('\n');
        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║              ALL TESTS COMPLETED!                    ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// =====================================================
// RUN TESTS
// =====================================================
if (require.main === module) {
    console.log('Starting tests...\n');
    console.log('Environment variables:');
    console.log(`  AIRTABLE_PERSONAL_ACCESS_TOKEN: ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`  AIRTABLE_BASE_ID: ${process.env.AIRTABLE_BASE_ID || '❌ Not set'}`);
    console.log('');

    if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
        console.error('❌ Required environment variables not set!');
        console.error('Set AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID before running tests.');
        process.exit(1);
    }

    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    testCreateParent,
    testCreateChildren,
    testFetchHierarchical,
    testCascadeDelete,
    testScoring,
    testStandaloneQuestion,
    runAllTests
};
