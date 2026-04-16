import { db, collection, addDoc, serverTimestamp } from './src/lib/firebase';

const seedTemplates = async () => {
  const templates = [
    {
      title: "Senior Software Engineer (General)",
      description: "A comprehensive template for hiring senior-level developers with focus on system design and leadership.",
      rawNotes: "Senior Software Engineer\n- 5+ years experience\n- React, Node.js, TypeScript\n- System Design skills\n- Mentorship experience\n- Agile environment",
      category: "Engineering",
      authorName: "RecruitBox Team",
      userId: "system",
      installCount: 120,
      createdAt: serverTimestamp()
    },
    {
      title: "Product Manager (SaaS)",
      description: "Tailored for SaaS product management, focusing on user research, roadmap planning, and data-driven decisions.",
      rawNotes: "Product Manager\n- SaaS experience\n- User research & discovery\n- Roadmap management\n- Data analysis (SQL/Mixpanel)\n- Stakeholder management",
      category: "Product",
      authorName: "RecruitBox Team",
      userId: "system",
      installCount: 85,
      createdAt: serverTimestamp()
    },
    {
      title: "HR Business Partner",
      description: "Focuses on strategic HR, employee relations, and organizational development.",
      rawNotes: "HR Business Partner\n- Strategic HR planning\n- Employee relations\n- Performance management\n- Culture building\n- Compliance knowledge",
      category: "HR",
      authorName: "RecruitBox Team",
      userId: "system",
      installCount: 45,
      createdAt: serverTimestamp()
    }
  ];

  for (const t of templates) {
    await addDoc(collection(db, 'templates'), t);
  }
  console.log("Templates seeded!");
};

seedTemplates();
