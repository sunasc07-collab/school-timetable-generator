export const JUNIOR_SECONDARY_SUBJECTS = [
    "English Language",
    "Mathematics",
    "Basic Science and Technology (BST)",
    "   - Basic Science",
    "   - Basic Technology",
    "   - Computer Studies",
    "   - Physical and Health Education",
    "Pre-Vocational Studies (PVS)",
    "   - Home Economics",
    "   - Agriculture",
    "   - Entrepreneurship",
    "National Values Education (NVE)",
    "   - Civic Education",
    "   - Social Studies",
    "   - Security Education",
    "Cultural and Creative Arts (CCA)",
    "   - Music",
    "   - Drama",
    "   - Fine Art",
    "Business Studies",
    "French",
    "Christian Religious Studies (CRS)",
    "Islamic Religious Studies (IRS)",
    "Yoruba",
    "Hausa",
    "Igbo",
];

export const SENIOR_SECONDARY_SUBJECTS = [
    // Core Subjects
    "English Language",
    "Mathematics",
    "Civic Education",
    "Entrepreneurship",
    "Computer Studies",

    // Science
    "Physics",
    "Chemistry",
    "Biology",
    "Further Mathematics",
    "Agriculture",
    "Physical and Health Education (PHE)",

    // Humanities
    "Literature in English",
    "Government",
    "History",
    "Geography",
    "Christian Religious Studies (CRS)",
    "Islamic Religious Studies (IRS)",
    "Economics",

    // Business
    "Financial Accounting",
    "Commerce",
    "Store Management",

    // Technology
    "Technical Drawing",
    "Foods and Nutrition",
    "Home Management",
    
    // Languages
    "French",
    "Yoruba",
    "Hausa",
    "Igbo",

    // Arts
    "Music",
    "Fine Art",
    "Visual Arts",
    "Drama",
];

export const PRIMARY_SUBJECTS = [
    "English Language",
    "Mathematics",
    "Basic Science",
    "Social Studies",
    "Civic Education",
    "Computer Studies",
    "Physical and Health Education",
    "Agricultural Science",
    "Home Economics",
    "Christian Religious Studies (CRS)",
    "Islamic Religious Studies (IRS)",
    "Cultural and Creative Arts (CCA)",
    "French",
    "Yoruba",
    "Hausa",
    "Igbo",
    "Handwriting",
    "Verbal Reasoning",
    "Quantitative Reasoning",
];

export const PRE_SCHOOL_SUBJECTS = [
    "Phonics/Literacy",
    "Numeracy",
    "Creative Arts",
    "Practical Life Exercises",
    "Sensorial Education",
    "Rhymes and Songs",
    "Story Time",
];

export const A_LEVEL_SUBJECTS = [
    "Mathematics",
    "Further Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Business Studies",
    "Accounting",
    "Sociology",
    "Psychology",
    "Law",
    "Government & Politics",
    "History",
    "Geography",
    "Literature in English",
    "Art and Design",
    "Computer Science",
];

export const ALL_SUBJECTS = [...new Set([
    ...JUNIOR_SECONDARY_SUBJECTS,
    ...SENIOR_SECONDARY_SUBJECTS,
    ...PRIMARY_SUBJECTS,
    ...PRE_SCHOOL_SUBJECTS,
    ...A_LEVEL_SUBJECTS
])].map(subject => subject.trim()).filter(subject => !subject.startsWith("   -"));
