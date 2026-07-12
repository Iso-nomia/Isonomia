#!/usr/bin/env npx tsx
/**
 * Quick test to verify /api/aif/schemes returns CQs
 */

async function testAPI() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  try {
    console.log('Fetching schemes from /api/aif/schemes...');
    const response = await fetch(`${baseUrl}/api/aif/schemes?ensure=1`);
    const data = await response.json();
    
    console.log(`\n✅ API returned ${data.items?.length || 0} schemes\n`);
    
    // Find Popular Practice
    const popularPractice = data.items?.find((s: any) => s.key === 'popular_practice');
    
    if (popularPractice) {
      console.log('📋 Popular Practice Scheme:');
      console.log(`   Name: ${popularPractice.name}`);
      console.log(`   Key: ${popularPractice.key}`);
      console.log(`   CQs: ${popularPractice.cqs?.length || 0}`);
      
      if (popularPractice.cqs && popularPractice.cqs.length > 0) {
        console.log('\n✅ CQs ARE PRESENT:');
        popularPractice.cqs.forEach((cq: any, idx: number) => {
          console.log(`   ${idx + 1}. ${cq.text}`);
          console.log(`      Type: ${cq.attackType} | Scope: ${cq.targetScope}`);
        });
        
        console.log('\n🎉 SUCCESS: CQ Preview Panel should now work!');
        process.exit(0);
      } else {
        console.log('\n❌ PROBLEM: No CQs returned');
        console.log('   The API is not including CriticalQuestion relation');
        process.exit(1);
      }
    } else {
      console.log('\n❌ Popular Practice scheme not found');
      console.log('   Available schemes:', data.items?.map((s: any) => s.key).join(', '));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error fetching schemes:', error);
    process.exit(1);
  }
}

testAPI();
