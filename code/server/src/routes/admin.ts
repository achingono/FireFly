import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";

const adminRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/admin/seed — Idempotent seed for local development
  app.post("/api/v1/admin/seed", async (_request, reply) => {
    // ── Users ──────────────────────────────────────────────────
    const users = [
      { email: "student1@test.com", displayName: "Alex Explorer", role: "student" as const, age: 9, ageProfile: "fun" as const, onboarded: true },
      { email: "student2@test.com", displayName: "Maya Builder", role: "student" as const, age: 12, ageProfile: "balanced" as const, onboarded: true },
      { email: "student3@test.com", displayName: "Kai Coder", role: "student" as const, age: 15, ageProfile: "pro" as const, onboarded: true },
      { email: "teacher@test.com", displayName: "Ms. Rivera", role: "teacher" as const, age: 32, ageProfile: "pro" as const, onboarded: true },
      { email: "admin@test.com", displayName: "Admin User", role: "admin" as const, age: 30, ageProfile: "pro" as const, onboarded: true },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { displayName: u.displayName, role: u.role, age: u.age, ageProfile: u.ageProfile },
        create: u,
      });
    }

    // ── Concepts ───────────────────────────────────────────────
    const concepts = [
      { name: "Variables", description: "Store and retrieve data using named containers", tags: ["basics", "data"], difficulty: "beginner" as const, sortOrder: 1 },
      { name: "Data Types", description: "Understand integers, strings, floats, and booleans", tags: ["basics", "data"], difficulty: "beginner" as const, sortOrder: 2, prerequisites: ["Variables"] },
      { name: "Operators", description: "Arithmetic, comparison, and logical operators", tags: ["basics", "expressions"], difficulty: "beginner" as const, sortOrder: 3, prerequisites: ["Data Types"] },
      { name: "Conditionals", description: "Make decisions with if/elif/else statements", tags: ["control-flow"], difficulty: "beginner" as const, sortOrder: 4, prerequisites: ["Operators"] },
      { name: "Loops", description: "Repeat actions with for and while loops", tags: ["control-flow"], difficulty: "intermediate" as const, sortOrder: 5, prerequisites: ["Conditionals"] },
      { name: "Functions", description: "Define reusable blocks of code", tags: ["abstraction"], difficulty: "intermediate" as const, sortOrder: 6, prerequisites: ["Loops"] },
      { name: "Lists", description: "Work with ordered collections of data", tags: ["data-structures"], difficulty: "intermediate" as const, sortOrder: 7, prerequisites: ["Loops"] },
      { name: "Dictionaries", description: "Key-value pairs for structured data", tags: ["data-structures"], difficulty: "advanced" as const, sortOrder: 8, prerequisites: ["Lists", "Functions"] },
    ];

    // First pass: upsert without prerequisites (need IDs first)
    const conceptMap = new Map<string, string>();
    for (const c of concepts) {
      const { prerequisites: _prereqs, ...data } = c;
      const record = await prisma.concept.upsert({
        where: { name: c.name },
        update: { description: data.description, tags: data.tags, difficulty: data.difficulty, sortOrder: data.sortOrder },
        create: data,
      });
      conceptMap.set(c.name, record.id);
    }

    // Second pass: set prerequisites as concept IDs
    for (const c of concepts) {
      if (c.prerequisites) {
        const prereqIds = c.prerequisites.map((p) => conceptMap.get(p)).filter(Boolean) as string[];
        await prisma.concept.update({
          where: { name: c.name },
          data: { prerequisites: prereqIds },
        });
      }
    }

    // ── Lessons ────────────────────────────────────────────────
    const lessons = [
      { conceptName: "Variables", title: "Your First Variable", content: "# Variables\n\nA variable is like a labeled box that holds a value.\n\n```python\nname = \"Alex\"\nage = 10\nprint(name)\nprint(age)\n```\n\nYou can change what's in the box at any time!", sortOrder: 1 },
      { conceptName: "Data Types", title: "Types of Data", content: "# Data Types\n\nPython has several built-in data types:\n\n```python\nwhole_number = 42        # int\ndecimal = 3.14           # float\ntext = \"Hello\"           # str\nis_happy = True          # bool\n\nprint(type(whole_number))\nprint(type(text))\n```\n\nKnowing the type helps you understand what operations are possible.", sortOrder: 2 },
      { conceptName: "Operators", title: "Working with Operators", content: "# Operators\n\nOperators let you do math, compare values, and combine conditions.\n\n```python\n# Arithmetic\nresult = 10 + 3   # 13\nresult = 10 % 3   # 1 (remainder)\n\n# Comparison\nprint(5 > 3)      # True\nprint(5 == 3)     # False\n\n# Logical\nprint(True and False)  # False\nprint(True or False)   # True\n```", sortOrder: 3 },
      { conceptName: "Conditionals", title: "Making Decisions", content: "# Conditionals\n\nPrograms can make decisions using `if` statements.\n\n```python\ntemperature = 30\nif temperature > 25:\n    print(\"It's hot!\")\nelse:\n    print(\"It's cool.\")\n```", sortOrder: 4 },
      { conceptName: "Loops", title: "Repeating with Loops", content: "# Loops\n\nLoops let you repeat code.\n\n```python\nfor i in range(5):\n    print(f\"Count: {i}\")\n```\n\nThe `for` loop runs the indented code once for each value.", sortOrder: 5 },
      { conceptName: "Functions", title: "Building Blocks", content: "# Functions\n\nFunctions are reusable blocks of code.\n\n```python\ndef greet(name):\n    return f\"Hello, {name}!\"\n\nmessage = greet(\"Maya\")\nprint(message)\n```", sortOrder: 6 },
      { conceptName: "Lists", title: "Collections of Data", content: "# Lists\n\nLists store multiple items in order.\n\n```python\nfruits = [\"apple\", \"banana\", \"cherry\"]\nfor fruit in fruits:\n    print(fruit)\n```", sortOrder: 7 },
      { conceptName: "Dictionaries", title: "Key-Value Pairs", content: "# Dictionaries\n\nDictionaries store data as key-value pairs.\n\n```python\nstudent = {\n    \"name\": \"Alex\",\n    \"age\": 10,\n    \"grade\": \"5th\"\n}\n\nprint(student[\"name\"])    # Alex\nprint(student.get(\"age\")) # 10\n\n# Add a new key\nstudent[\"school\"] = \"FireFly Academy\"\n```\n\nDictionaries are perfect for representing structured information.", sortOrder: 8 },
    ];

    const lessonRecords: Array<{ id: string; conceptName: string }> = [];
    for (const l of lessons) {
      const conceptId = conceptMap.get(l.conceptName);
      if (!conceptId) continue;
      const record = await prisma.lesson.upsert({
        where: { id: conceptId + "-" + l.sortOrder }, // deterministic ID for idempotency
        update: { title: l.title, content: l.content, sortOrder: l.sortOrder },
        create: { id: conceptId + "-" + l.sortOrder, conceptId, title: l.title, content: l.content, sortOrder: l.sortOrder },
      });
      lessonRecords.push({ id: record.id, conceptName: l.conceptName });
    }

    // ── Exercises ──────────────────────────────────────────────
    const exercises = [
      // ── Variables (3 exercises) ──
      { conceptName: "Variables", title: "Swap Two Variables", description: "Swap the values of two variables without a temporary variable.", starterCode: "a = 5\nb = 10\n# Swap a and b below\n\nprint(a, b)  # Should print: 10 5", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Variables", title: "Name and Age", description: "Create variables for your name and age, then print a greeting.", starterCode: "# Create name and age variables\n\n# Print: Hello, I'm [name] and I'm [age] years old!", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Variables", title: "Temperature Converter", description: "Store a temperature in Celsius in a variable, convert it to Fahrenheit (F = C * 9/5 + 32), and print both values.", starterCode: "celsius = 25\n# Convert to Fahrenheit and print both\n", difficulty: "beginner" as const, language: "python" },

      // ── Data Types (3 exercises) ──
      { conceptName: "Data Types", title: "Type Detective", description: "Create one variable of each type (int, float, str, bool) and print each variable's type using type().", starterCode: "# Create four variables, one of each type:\n# int, float, str, bool\n\n# Print the type of each variable\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Data Types", title: "String to Number", description: "Convert the string '42' to an integer and the string '3.14' to a float. Print the sum of both.", starterCode: "text_int = \"42\"\ntext_float = \"3.14\"\n# Convert to numbers and print their sum\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Data Types", title: "Type Checker", description: "Write code that checks if a value is a string. If it is, print its length. If it's a number, print its double.", starterCode: "value = \"hello\"\n# Check the type and print accordingly\n# If string: print length\n# If int or float: print double\n", difficulty: "intermediate" as const, language: "python" },

      // ── Operators (3 exercises) ──
      { conceptName: "Operators", title: "Simple Calculator", description: "Given two numbers, print the result of adding, subtracting, multiplying, and dividing them.", starterCode: "a = 15\nb = 4\n# Print the result of +, -, *, / for a and b\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Operators", title: "Remainder and Floor", description: "Use the modulo (%) and floor division (//) operators. Given a number of minutes, print the hours and remaining minutes.", starterCode: "total_minutes = 135\n# Calculate hours and remaining minutes\n# Print: 135 minutes = 2 hours and 15 minutes\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Operators", title: "Comparison Chain", description: "Given three numbers, use comparison operators to determine and print the largest one without using max().", starterCode: "x = 7\ny = 15\nz = 10\n# Find and print the largest number using comparisons\n", difficulty: "intermediate" as const, language: "python" },

      // ── Conditionals (3 exercises) ──
      { conceptName: "Conditionals", title: "Even or Odd", description: "Write a program that checks if a number is even or odd.", starterCode: "number = 7\n# Check if number is even or odd\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Conditionals", title: "Grade Calculator", description: "Convert a numeric score to a letter grade (A/B/C/D/F).", starterCode: "score = 85\n# Convert to letter grade\n# A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: below 60\n", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Conditionals", title: "Leap Year", description: "Check if a given year is a leap year. A leap year is divisible by 4, but not by 100 — unless also divisible by 400.", starterCode: "year = 2024\n# Determine if it's a leap year and print the result\n", difficulty: "intermediate" as const, language: "python" },

      // ── Loops (3 exercises) ──
      { conceptName: "Loops", title: "Sum 1 to N", description: "Calculate the sum of all numbers from 1 to N.", starterCode: "n = 10\ntotal = 0\n# Add numbers 1 to n\n\nprint(total)  # Should print: 55", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Loops", title: "FizzBuzz", description: "Print FizzBuzz for numbers 1-20.", starterCode: "# For each number 1-20:\n# Print 'Fizz' if divisible by 3\n# Print 'Buzz' if divisible by 5\n# Print 'FizzBuzz' if divisible by both\n# Otherwise print the number\n", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Loops", title: "Multiplication Table", description: "Print the multiplication table for a given number (1 through 10).", starterCode: "num = 7\n# Print the multiplication table for num\n# Example: 7 x 1 = 7, 7 x 2 = 14, ...\n", difficulty: "beginner" as const, language: "python" },

      // ── Functions (3 exercises) ──
      { conceptName: "Functions", title: "Factorial", description: "Write a function that calculates the factorial of a number.", starterCode: "def factorial(n):\n    # Your code here\n    pass\n\nprint(factorial(5))  # Should print: 120", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Functions", title: "Palindrome Check", description: "Write a function to check if a string is a palindrome.", starterCode: "def is_palindrome(text):\n    # Your code here\n    pass\n\nprint(is_palindrome(\"racecar\"))  # True\nprint(is_palindrome(\"hello\"))    # False", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Functions", title: "Power Function", description: "Write a function that calculates base raised to the power of exp without using ** or pow().", starterCode: "def power(base, exp):\n    # Your code here\n    pass\n\nprint(power(2, 10))  # Should print: 1024\nprint(power(3, 4))   # Should print: 81", difficulty: "intermediate" as const, language: "python" },

      // ── Lists (3 exercises) ──
      { conceptName: "Lists", title: "Find Maximum", description: "Find the largest number in a list without using max().", starterCode: "numbers = [3, 7, 2, 8, 1, 9, 4]\n# Find the maximum without using max()\n\nprint(maximum)  # Should print: 9", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Lists", title: "Reverse a List", description: "Reverse a list in place without using the built-in reverse() method or slicing.", starterCode: "items = [1, 2, 3, 4, 5]\n# Reverse items in place\n\nprint(items)  # Should print: [5, 4, 3, 2, 1]", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Lists", title: "Remove Duplicates", description: "Remove duplicate values from a list while keeping the original order.", starterCode: "numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]\n# Remove duplicates, keep order\n\nprint(unique)  # Should print: [3, 1, 4, 5, 9, 2, 6]", difficulty: "intermediate" as const, language: "python" },

      // ── Dictionaries (3 exercises) ──
      { conceptName: "Dictionaries", title: "Word Counter", description: "Count how many times each word appears in a sentence using a dictionary.", starterCode: "sentence = \"the cat sat on the mat the cat\"\n# Count each word's occurrences\n\nprint(counts)  # Should show each word and its count", difficulty: "intermediate" as const, language: "python" },
      { conceptName: "Dictionaries", title: "Phone Book", description: "Create a phone book dictionary. Add three contacts, look up one, and print all contacts.", starterCode: "phone_book = {}\n# Add contacts: Alice=555-1234, Bob=555-5678, Carol=555-9012\n# Look up Bob's number\n# Print all contacts\n", difficulty: "beginner" as const, language: "python" },
      { conceptName: "Dictionaries", title: "Invert a Dictionary", description: "Swap the keys and values of a dictionary. Assume all values are unique.", starterCode: "original = {\"a\": 1, \"b\": 2, \"c\": 3}\n# Create inverted dict where keys become values and vice versa\n\nprint(inverted)  # Should print: {1: 'a', 2: 'b', 3: 'c'}", difficulty: "intermediate" as const, language: "python" },
    ];

    for (const ex of exercises) {
      const conceptId = conceptMap.get(ex.conceptName);
      if (!conceptId) continue;
      const { conceptName, ...exData } = ex;
      const deterministicId = conceptId + "-ex-" + exData.title.toLowerCase().replace(/\s+/g, "-");
      const record = await prisma.exercise.upsert({
        where: { id: deterministicId },
        update: { title: exData.title, description: exData.description, starterCode: exData.starterCode, difficulty: exData.difficulty, language: exData.language },
        create: { id: deterministicId, ...exData, conceptTags: [ex.conceptName.toLowerCase()] },
      });

      // Link exercise to lesson
      const lesson = lessonRecords.find((l) => l.conceptName === conceptName);
      if (lesson) {
        await prisma.lesson_Exercise.upsert({
          where: { lessonId_exerciseId: { lessonId: lesson.id, exerciseId: record.id } },
          update: {},
          create: { lessonId: lesson.id, exerciseId: record.id },
        });
      }
    }

    const counts = {
      users: await prisma.user.count(),
      concepts: await prisma.concept.count(),
      lessons: await prisma.lesson.count(),
      exercises: await prisma.exercise.count(),
    };

    return reply.envelope(counts);
  });
};

export default adminRoutes;
