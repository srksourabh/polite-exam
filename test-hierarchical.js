// Test script for hierarchical question features

console.log('\n=== TEST 1: Hierarchical Number Calculation ===');

function getHierarchicalQuestionNumber(questions, questionIndex) {
    const question = questions[questionIndex];
    const isSubQuestion = question['Is Sub Question'] === true;
    const parentQuestionId = question['Parent Question ID'];
    const subQuestionOrder = question['Sub Question Order'];

    if (isSubQuestion && parentQuestionId) {
        const parentIndex = questions.findIndex(q => q.ID === parentQuestionId);
        if (parentIndex !== -1) {
            const parentNum = parentIndex + 1;
            const subOrder = subQuestionOrder || 1;
            return { display: parentNum + '.' + subOrder, isSubQ: true };
        }
    }
    return { display: questionIndex + 1, isSubQ: false };
}

// Test data
const testQuestions = [
    { ID: 'Q001', Question: 'Standalone Q1' },
    { ID: 'Q002', Question: 'Passage text...', 'Option A': '', 'Option B': '' },
    { ID: 'Q003', Question: 'Sub Q1?', 'Is Sub Question': true, 'Parent Question ID': 'Q002', 'Sub Question Order': 1 },
    { ID: 'Q004', Question: 'Sub Q2?', 'Is Sub Question': true, 'Parent Question ID': 'Q002', 'Sub Question Order': 2 },
    { ID: 'Q005', Question: 'Standalone Q5' }
];

const results = testQuestions.map((q, i) => getHierarchicalQuestionNumber(testQuestions, i));
console.log('Q001 (Standalone):', results[0].display, '- Expected: 1');
console.log('Q002 (Passage):', results[1].display, '- Expected: 2');
console.log('Q003 (Sub-Q):', results[2].display, '- Expected: 2.1');
console.log('Q004 (Sub-Q):', results[3].display, '- Expected: 2.2');
console.log('Q005 (Standalone):', results[4].display, '- Expected: 5');

const test1Pass = results[0].display === 1 && results[1].display === 2 &&
                  results[2].display === '2.1' && results[3].display === '2.2' &&
                  results[4].display === 5;
console.log('TEST 1:', test1Pass ? '✅ PASSED' : '❌ FAILED');


console.log('\n=== TEST 2: Scoring Logic (Passages Excluded) ===');

function calculateScore(questions, userAnswers) {
    let score = 0;
    questions.forEach((question, index) => {
        const isMainPassage = !question['Option A'] && !question['Option B'];
        const userAnswer = userAnswers[index];
        const hasAnswered = typeof userAnswer === 'number' && userAnswer >= 0;
        const isCorrect = userAnswer === question.correctIndex;

        if (!isMainPassage && hasAnswered) {
            score += isCorrect ? 1 : -0.25;
        }
    });
    return score;
}

const scoringQuestions = [
    { ID: 'Q1', 'Option A': 'A', 'Option B': 'B', correctIndex: 0 },
    { ID: 'Q2', 'Option A': '', 'Option B': '' },  // Passage - NOT scored
    { ID: 'Q3', 'Option A': 'A', 'Option B': 'B', correctIndex: 1 },
];

const userAnswers = [0, 0, 0];  // Q1=correct, Q2=ignored, Q3=wrong
const score = calculateScore(scoringQuestions, userAnswers);
console.log('Score:', score, '- Expected: 0.75 (1 - 0.25)');
const test2Pass = score === 0.75;
console.log('TEST 2:', test2Pass ? '✅ PASSED' : '❌ FAILED');


console.log('\n=== TEST 3: Passage Detection ===');

function isPassage(q) {
    // Returns truthy if passage (no options but has question text)
    return !q['Option A'] && !q['Option B'] && q.Question;
}

const passageQ = { Question: 'Read the passage...', 'Option A': '', 'Option B': '' };
const normalQ = { Question: 'What is 2+2?', 'Option A': '3', 'Option B': '4' };

// Check truthy/falsy values (JavaScript behavior)
const passageResult = !!isPassage(passageQ);
const normalResult = !!isPassage(normalQ);

console.log('Passage detection:', passageResult, '- Expected: true');
console.log('Normal Q detection:', normalResult, '- Expected: false');
const test3Pass = passageResult === true && normalResult === false;
console.log('TEST 3:', test3Pass ? '✅ PASSED' : '❌ FAILED');


console.log('\n=== TEST 4: AI Question Type Detection ===');

function processAIResponse(questions) {
    return questions.map((q, index) => {
        const questionType = q.questionType || 'standalone';
        const isPassage = questionType === 'passage';
        const isSubQuestion = questionType === 'sub-question';

        return {
            id: isPassage ? `PASSAGE_${index}` : `Q_${index}`,
            questionType: isPassage ? 'Main Question' : (isSubQuestion ? 'Sub Question' : 'Standalone'),
            hasOptions: !isPassage
        };
    });
}

const aiResponse = [
    { question: 'Passage text', questionType: 'passage', optionA: '', optionB: '' },
    { question: 'Sub Q1', questionType: 'sub-question', optionA: 'A', parentId: 'passage_1' },
    { question: 'Standalone', questionType: 'standalone', optionA: 'A' }
];

const processed = processAIResponse(aiResponse);
console.log('Passage processed:', processed[0].questionType, '- Expected: Main Question');
console.log('Sub-Q processed:', processed[1].questionType, '- Expected: Sub Question');
console.log('Standalone processed:', processed[2].questionType, '- Expected: Standalone');

const test4Pass = processed[0].questionType === 'Main Question' &&
                  processed[1].questionType === 'Sub Question' &&
                  processed[2].questionType === 'Standalone';
console.log('TEST 4:', test4Pass ? '✅ PASSED' : '❌ FAILED');


console.log('\n=== TEST 5: Marks Display ===');

function getMarksDisplay(questionType) {
    if (questionType === 'Main Question') return 'No Marks';
    return '+1 / -0.25';
}

console.log('Passage marks:', getMarksDisplay('Main Question'), '- Expected: No Marks');
console.log('Sub-Q marks:', getMarksDisplay('Sub Question'), '- Expected: +1 / -0.25');
console.log('Standalone marks:', getMarksDisplay('Standalone'), '- Expected: +1 / -0.25');

const test5Pass = getMarksDisplay('Main Question') === 'No Marks' &&
                  getMarksDisplay('Sub Question') === '+1 / -0.25';
console.log('TEST 5:', test5Pass ? '✅ PASSED' : '❌ FAILED');


console.log('\n========================================');
console.log('           TEST SUMMARY');
console.log('========================================');
const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass;
console.log('Test 1 (Hierarchical Numbers):', test1Pass ? '✅' : '❌');
console.log('Test 2 (Scoring Logic):', test2Pass ? '✅' : '❌');
console.log('Test 3 (Passage Detection):', test3Pass ? '✅' : '❌');
console.log('Test 4 (AI Type Detection):', test4Pass ? '✅' : '❌');
console.log('Test 5 (Marks Display):', test5Pass ? '✅' : '❌');
console.log('----------------------------------------');
console.log('OVERALL:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
console.log('========================================\n');

process.exit(allPassed ? 0 : 1);
