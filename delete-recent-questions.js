#!/usr/bin/env node
/**
 * Script to delete all questions added in the last N hours
 *
 * Usage:
 *   node delete-recent-questions.js [hours]
 *
 * Environment variables required:
 *   AIRTABLE_PERSONAL_ACCESS_TOKEN - Your Airtable PAT token
 *   AIRTABLE_BASE_ID - Your Airtable base ID
 *
 * Examples:
 *   node delete-recent-questions.js 4        # Delete questions from last 4 hours
 *   node delete-recent-questions.js          # Default: 4 hours
 *   DRY_RUN=1 node delete-recent-questions.js  # Preview without deleting
 */

require('dotenv').config();
const Airtable = require('airtable');

// Configuration
const HOURS = parseInt(process.argv[2]) || 4;
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const QUESTIONS_TABLE = 'Questions';

// Validate environment
if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    console.error('ERROR: AIRTABLE_PERSONAL_ACCESS_TOKEN environment variable is required');
    console.error('Set it in .env file or export it before running this script');
    process.exit(1);
}

if (!process.env.AIRTABLE_BASE_ID) {
    console.error('ERROR: AIRTABLE_BASE_ID environment variable is required');
    console.error('Set it in .env file or export it before running this script');
    process.exit(1);
}

// Initialize Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

async function deleteRecentQuestions() {
    console.log('='.repeat(60));
    console.log(`  DELETE QUESTIONS FROM LAST ${HOURS} HOURS`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN MODE - No questions will be deleted\n');
    }

    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - HOURS);
    const cutoffISO = cutoffTime.toISOString();

    console.log(`Current time: ${new Date().toISOString()}`);
    console.log(`Cutoff time:  ${cutoffISO}`);
    console.log(`Deleting questions created after: ${cutoffTime.toLocaleString()}\n`);

    try {
        // Fetch all questions - Airtable automatically includes createdTime
        console.log('Fetching questions from Airtable...');

        const allRecords = await base(QUESTIONS_TABLE).select({
            // Sort by created time descending to see newest first
            sort: [{ field: 'ID', direction: 'desc' }]
        }).all();

        console.log(`Total questions in database: ${allRecords.length}\n`);

        // Filter questions created after cutoff time
        // Airtable records have a _rawJson.createdTime field
        const recentQuestions = allRecords.filter(record => {
            const createdTime = record._rawJson?.createdTime;
            if (!createdTime) {
                console.log(`  Warning: No createdTime for record ${record.id}`);
                return false;
            }
            return new Date(createdTime) > cutoffTime;
        });

        if (recentQuestions.length === 0) {
            console.log('✅ No questions found in the specified time range.');
            console.log('Nothing to delete.');
            return;
        }

        console.log(`Found ${recentQuestions.length} questions to delete:\n`);
        console.log('-'.repeat(60));

        // Display questions to be deleted
        recentQuestions.forEach((record, index) => {
            const fields = record.fields;
            const createdTime = new Date(record._rawJson.createdTime).toLocaleString();
            const isSubQ = fields['Is Sub Question'] ? ' [Sub-Q]' : '';
            const parentId = fields['Parent Question ID'] ? ` (Parent: ${fields['Parent Question ID']})` : '';

            console.log(`${index + 1}. ${fields.ID || 'No ID'}${isSubQ}${parentId}`);
            console.log(`   Subject: ${fields.Subject || 'N/A'}`);
            console.log(`   Question: ${(fields.Question || '').substring(0, 50)}...`);
            console.log(`   Created: ${createdTime}`);
            console.log(`   Record ID: ${record.id}`);
            console.log('');
        });

        console.log('-'.repeat(60));
        console.log(`\nTotal to delete: ${recentQuestions.length} questions\n`);

        if (DRY_RUN) {
            console.log('⚠️  DRY RUN - Skipping deletion');
            console.log('Run without DRY_RUN=1 to actually delete these questions');
            return;
        }

        // Confirmation prompt
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question(`\n⚠️  Are you sure you want to delete ${recentQuestions.length} questions? (yes/no): `, resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'yes') {
            console.log('\n❌ Deletion cancelled.');
            return;
        }

        // Delete in batches (Airtable allows max 10 records per destroy call)
        console.log('\nDeleting questions...');
        const recordIds = recentQuestions.map(r => r.id);
        const batchSize = 10;
        let deleted = 0;

        for (let i = 0; i < recordIds.length; i += batchSize) {
            const batch = recordIds.slice(i, i + batchSize);
            await base(QUESTIONS_TABLE).destroy(batch);
            deleted += batch.length;
            console.log(`  Deleted ${deleted}/${recordIds.length} questions...`);

            // Small delay to avoid rate limiting
            if (i + batchSize < recordIds.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Successfully deleted ${deleted} questions`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.statusCode === 401) {
            console.error('Authentication failed. Check your AIRTABLE_PERSONAL_ACCESS_TOKEN');
        } else if (error.statusCode === 404) {
            console.error('Table not found. Check your AIRTABLE_BASE_ID and table name');
        }
        process.exit(1);
    }
}

// Run the script
deleteRecentQuestions().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
