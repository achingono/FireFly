import { PrismaClient } from "@prisma/client";

export async function seedUsers(prisma: PrismaClient): Promise<void> {
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
}

export async function seedConcepts(prisma: PrismaClient): Promise<Map<string, string>> {
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

  for (const c of concepts) {
    if (c.prerequisites) {
      const prereqIds = c.prerequisites.map((p) => conceptMap.get(p)).filter(Boolean) as string[];
      await prisma.concept.update({
        where: { name: c.name },
        data: { prerequisites: prereqIds },
      });
    }
  }

  return conceptMap;
}

export async function seedLessons(
  prisma: PrismaClient,
  conceptMap: Map<string, string>
): Promise<Array<{ id: string; conceptName: string }>> {
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
      where: { id: conceptId + "-" + l.sortOrder },
      update: { title: l.title, content: l.content, sortOrder: l.sortOrder },
      create: { id: conceptId + "-" + l.sortOrder, conceptId, title: l.title, content: l.content, sortOrder: l.sortOrder },
    });
    lessonRecords.push({ id: record.id, conceptName: l.conceptName });
  }

  return lessonRecords;
}

export async function seedExercises(
  prisma: PrismaClient,
  conceptMap: Map<string, string>,
  lessonRecords: Array<{ id: string; conceptName: string }>
): Promise<void> {
  const exercises = [
    // ── Variables (3 exercises) ──
    {
      conceptName: "Variables",
      title: "Swap Two Variables",
      description: "Swap the values of two variables without a temporary variable.",
      starterCode: "a = 5\nb = 10\n# Swap a and b below\n\nprint(a, b)  # Should print: 10 5",
      solutionCode: "a = 5\nb = 10\na, b = b, a\nprint(a, b)",
      hints: ["Think about tuple unpacking", "Python allows you to assign multiple variables at once"],
      testCases: [{ input: "", expectedOutput: "10 5" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Variables",
      title: "Name and Age",
      description: "Create variables for your name and age, then print a greeting.",
      starterCode: "# Create name and age variables\n\n# Print: Hello, I'm [name] and I'm [age] years old!",
      solutionCode: "name = \"Alex\"\nage = 10\nprint(f\"Hello, I'm {name} and I'm {age} years old!\")",
      hints: ["Use variable assignment", "Use f-strings for string formatting"],
      testCases: [{ input: "", expectedOutput: "Hello, I'm Alex and I'm 10 years old!" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Variables",
      title: "Temperature Converter",
      description: "Store a temperature in Celsius in a variable, convert it to Fahrenheit (F = C * 9/5 + 32), and print both values.",
      starterCode: "celsius = 25\n# Convert to Fahrenheit and print both\n",
      solutionCode: "celsius = 25\nfahrenheit = celsius * 9/5 + 32\nprint(f\"{celsius}C = {fahrenheit}F\")",
      hints: ["Use the formula F = C * 9/5 + 32", "Store the result in a new variable"],
      testCases: [{ input: "", expectedOutput: "25C = 77.0F" }],
      difficulty: "beginner" as const,
      language: "python",
    },

    // ── Data Types (3 exercises) ──
    {
      conceptName: "Data Types",
      title: "Type Detective",
      description: "Create one variable of each type (int, float, str, bool) and print each variable's type using type().",
      starterCode: "# Create four variables, one of each type:\n# int, float, str, bool\n\n# Print the type of each variable\n",
      solutionCode: "my_int = 42\nmy_float = 3.14\nmy_str = \"hello\"\nmy_bool = True\nprint(type(my_int))\nprint(type(my_float))\nprint(type(my_str))\nprint(type(my_bool))",
      hints: ["Create one variable of each type", "Use the type() function to check"],
      testCases: [{ input: "", expectedOutput: "<class 'int'>\n<class 'float'>\n<class 'str'>\n<class 'bool'>" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Data Types",
      title: "String to Number",
      description: "Convert the string '42' to an integer and the string '3.14' to a float. Print the sum of both.",
      starterCode: "text_int = \"42\"\ntext_float = \"3.14\"\n# Convert to numbers and print their sum\n",
      solutionCode: "text_int = \"42\"\ntext_float = \"3.14\"\nnum_int = int(text_int)\nnum_float = float(text_float)\nprint(num_int + num_float)",
      hints: ["Use int() to convert to integer", "Use float() to convert to float"],
      testCases: [{ input: "", expectedOutput: "45.14" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Data Types",
      title: "Type Checker",
      description: "Write code that checks if a value is a string. If it is, print its length. If it's a number, print its double.",
      starterCode: "value = \"hello\"\n# Check the type and print accordingly\n# If string: print length\n# If int or float: print double\n",
      solutionCode: "value = \"hello\"\nif isinstance(value, str):\n    print(len(value))\nelif isinstance(value, (int, float)):\n    print(value * 2)",
      hints: ["Use isinstance() to check types", "Strings have a len() function"],
      testCases: [{ input: "", expectedOutput: "5" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ── Operators (3 exercises) ──
    {
      conceptName: "Operators",
      title: "Simple Calculator",
      description: "Given two numbers, print the result of adding, subtracting, multiplying, and dividing them.",
      starterCode: "a = 15\nb = 4\n# Print the result of +, -, *, / for a and b\n",
      solutionCode: "a = 15\nb = 4\nprint(a + b)\nprint(a - b)\nprint(a * b)\nprint(a / b)",
      hints: ["Use +, -, *, / operators", "Print each result on a new line"],
      testCases: [{ input: "", expectedOutput: "19\n11\n60\n3.75" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Operators",
      title: "Remainder and Floor",
      description: "Use the modulo (%) and floor division (//) operators. Given a number of minutes, print the hours and remaining minutes.",
      starterCode: "total_minutes = 135\n# Calculate hours and remaining minutes\n# Print: 135 minutes = 2 hours and 15 minutes\n",
      solutionCode: "total_minutes = 135\nhours = total_minutes // 60\nminutes = total_minutes % 60\nprint(f\"{total_minutes} minutes = {hours} hours and {minutes} minutes\")",
      hints: ["Use // for floor division to get hours", "Use % (modulo) to get remaining minutes"],
      testCases: [{ input: "", expectedOutput: "135 minutes = 2 hours and 15 minutes" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Operators",
      title: "Comparison Chain",
      description: "Given three numbers, use comparison operators to determine and print the largest one without using max().",
      starterCode: "x = 7\ny = 15\nz = 10\n# Find and print the largest number using comparisons\n",
      solutionCode: "x = 7\ny = 15\nz = 10\nif x >= y and x >= z:\n    print(x)\nelif y >= x and y >= z:\n    print(y)\nelse:\n    print(z)",
      hints: ["Use >= operators to compare", "Use if/elif/else statements"],
      testCases: [{ input: "", expectedOutput: "15" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ── Conditionals (3 exercises) ──
    {
      conceptName: "Conditionals",
      title: "Even or Odd",
      description: "Write a program that checks if a number is even or odd.",
      starterCode: "number = 7\n# Check if number is even or odd\n",
      solutionCode: "number = 7\nif number % 2 == 0:\n    print(\"even\")\nelse:\n    print(\"odd\")",
      hints: ["Use % (modulo) to check remainder", "If remainder is 0, it's even"],
      testCases: [{ input: "", expectedOutput: "odd" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Conditionals",
      title: "Grade Calculator",
      description: "Convert a numeric score to a letter grade (A/B/C/D/F).",
      starterCode: "score = 85\n# Convert to letter grade\n# A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: below 60\n",
      solutionCode: "score = 85\nif score >= 90:\n    print('A')\nelif score >= 80:\n    print('B')\nelif score >= 70:\n    print('C')\nelif score >= 60:\n    print('D')\nelse:\n    print('F')",
      hints: ["Use multiple if/elif/else statements", "Check ranges in order from highest to lowest"],
      testCases: [{ input: "", expectedOutput: "B" }],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Conditionals",
      title: "Leap Year",
      description: "Check if a given year is a leap year. A leap year is divisible by 4, but not by 100 — unless also divisible by 400.",
      starterCode: "year = 2024\n# Determine if it's a leap year and print the result\n",
      solutionCode: "year = 2024\nif year % 400 == 0:\n    print(\"leap\")\nelif year % 100 == 0:\n    print(\"not leap\")\nelif year % 4 == 0:\n    print(\"leap\")\nelse:\n    print(\"not leap\")",
      hints: ["Check divisibility by 400 first", "Then check 100, then 4"],
      testCases: [{ input: "", expectedOutput: "leap" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ── Loops (3 exercises) ──
    {
      conceptName: "Loops",
      title: "Sum 1 to N",
      description: "Calculate the sum of all numbers from 1 to N.",
      starterCode: "n = 10\ntotal = 0\n# Add numbers 1 to n\n\nprint(total)  # Should print: 55",
      solutionCode: "n = 10\ntotal = 0\nfor i in range(1, n + 1):\n    total += i\nprint(total)",
      hints: ["Use a for loop with range()", "Add each number to the total"],
      testCases: [{ input: "", expectedOutput: "55" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Loops",
      title: "FizzBuzz",
      description: "Print FizzBuzz for numbers 1-20.",
      starterCode: "# For each number 1-20:\n# Print 'Fizz' if divisible by 3\n# Print 'Buzz' if divisible by 5\n# Print 'FizzBuzz' if divisible by both\n# Otherwise print the number\n",
      solutionCode: "for i in range(1, 21):\n    if i % 15 == 0:\n        print('FizzBuzz')\n    elif i % 3 == 0:\n        print('Fizz')\n    elif i % 5 == 0:\n        print('Buzz')\n    else:\n        print(i)",
      hints: ["Check divisibility by 15 first (for FizzBuzz)", "Use elif for the other conditions"],
      testCases: [{ input: "", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz" }],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Loops",
      title: "Multiplication Table",
      description: "Print the multiplication table for a given number (1 through 10).",
      starterCode: "num = 7\n# Print the multiplication table for num\n# Example: 7 x 1 = 7, 7 x 2 = 14, ...\n",
      solutionCode: "num = 7\nfor i in range(1, 11):\n    print(f\"{num} x {i} = {num * i}\")",
      hints: ["Use a for loop from 1 to 10", "Use string formatting to print nicely"],
      testCases: [{ input: "", expectedOutput: "7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70" }],
      difficulty: "beginner" as const,
      language: "python",
    },

    // ── Functions (3 exercises) ──
    {
      conceptName: "Functions",
      title: "Factorial",
      description: "Write a function that calculates the factorial of a number.",
      starterCode: "def factorial(n):\n    # Your code here\n    pass\n\nprint(factorial(5))  # Should print: 120",
      solutionCode: "def factorial(n):\n    if n == 0 or n == 1:\n        return 1\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result\n\nprint(factorial(5))",
      hints: ["Factorial of n = n × (n-1) × ... × 1", "0! = 1 and 1! = 1"],
      testCases: [{ input: "", expectedOutput: "120" }],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Functions",
      title: "Palindrome Check",
      description: "Write a function to check if a string is a palindrome.",
      starterCode: "def is_palindrome(text):\n    # Your code here\n    pass\n\nprint(is_palindrome(\"racecar\"))  # True\nprint(is_palindrome(\"hello\"))    # False",
      solutionCode: "def is_palindrome(text):\n    cleaned = text.lower().replace(\" \", \"\")\n    return cleaned == cleaned[::-1]\n\nprint(is_palindrome(\"racecar\"))\nprint(is_palindrome(\"hello\"))",
      hints: ["Reverse the string and compare", "Use string slicing with [::-1]"],
      testCases: [
        { input: "", expectedOutput: "True\nFalse" },
      ],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Functions",
      title: "Power Function",
      description: "Write a function that calculates base raised to the power of exp without using ** or pow().",
      starterCode: "def power(base, exp):\n    # Your code here\n    pass\n\nprint(power(2, 10))  # Should print: 1024\nprint(power(3, 4))   # Should print: 81",
      solutionCode: "def power(base, exp):\n    result = 1\n    for _ in range(exp):\n        result *= base\n    return result\n\nprint(power(2, 10))\nprint(power(3, 4))",
      hints: ["Multiply base by itself exp times", "Use a loop to repeat the multiplication"],
      testCases: [{ input: "", expectedOutput: "1024\n81" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ── Lists (3 exercises) ──
    {
      conceptName: "Lists",
      title: "Find Maximum",
      description: "Find the largest number in a list without using max().",
      starterCode: "numbers = [3, 7, 2, 8, 1, 9, 4]\n# Find the maximum without using max()\n\nprint(maximum)  # Should print: 9",
      solutionCode: "numbers = [3, 7, 2, 8, 1, 9, 4]\nmaximum = numbers[0]\nfor num in numbers:\n    if num > maximum:\n        maximum = num\nprint(maximum)",
      hints: ["Start with the first element", "Compare each element and update if larger"],
      testCases: [{ input: "", expectedOutput: "9" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Lists",
      title: "Reverse a List",
      description: "Reverse a list in place without using the built-in reverse() method or slicing.",
      starterCode: "items = [1, 2, 3, 4, 5]\n# Reverse items in place\n\nprint(items)  # Should print: [5, 4, 3, 2, 1]",
      solutionCode: "items = [1, 2, 3, 4, 5]\nfor i in range(len(items) // 2):\n    j = len(items) - 1 - i\n    items[i], items[j] = items[j], items[i]\nprint(items)",
      hints: ["Swap elements from both ends", "Move towards the middle"],
      testCases: [{ input: "", expectedOutput: "[5, 4, 3, 2, 1]" }],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Lists",
      title: "Remove Duplicates",
      description: "Remove duplicate values from a list while keeping the original order.",
      starterCode: "numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]\n# Remove duplicates, keep order\n\nprint(unique)  # Should print: [3, 1, 4, 5, 9, 2, 6]",
      solutionCode: "numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]\nunique = []\nfor num in numbers:\n    if num not in unique:\n        unique.append(num)\nprint(unique)",
      hints: ["Use a new list to store unique values", "Check if element is already in the list"],
      testCases: [{ input: "", expectedOutput: "[3, 1, 4, 5, 9, 2, 6]" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ── Dictionaries (3 exercises) ──
    {
      conceptName: "Dictionaries",
      title: "Word Counter",
      description: "Count how many times each word appears in a sentence using a dictionary.",
      starterCode: "sentence = \"the cat sat on the mat the cat\"\n# Count each word's occurrences\n\nprint(counts)  # Should show each word and its count",
      solutionCode: "sentence = \"the cat sat on the mat the cat\"\nwords = sentence.split()\ncounts = {}\nfor word in words:\n    if word in counts:\n        counts[word] += 1\n    else:\n        counts[word] = 1\nprint(counts)",
      hints: ["Use split() to break sentence into words", "Use a dictionary to track counts"],
      testCases: [{ input: "", expectedOutput: "{'the': 3, 'cat': 2, 'sat': 1, 'on': 1, 'mat': 1}" }],
      difficulty: "intermediate" as const,
      language: "python",
    },
    {
      conceptName: "Dictionaries",
      title: "Phone Book",
      description: "Create a phone book dictionary. Add three contacts, look up one, and print all contacts.",
      starterCode: "phone_book = {}\n# Add contacts: Alice=555-1234, Bob=555-5678, Carol=555-9012\n# Look up Bob's number\n# Print all contacts\n",
      solutionCode: "phone_book = {}\nphone_book[\"Alice\"] = \"555-1234\"\nphone_book[\"Bob\"] = \"555-5678\"\nphone_book[\"Carol\"] = \"555-9012\"\nprint(phone_book[\"Bob\"])\nprint(phone_book)",
      hints: ["Use key:value pairs in dictionaries", "Access values using square brackets"],
      testCases: [{ input: "", expectedOutput: "555-5678\n{'Alice': '555-1234', 'Bob': '555-5678', 'Carol': '555-9012'}" }],
      difficulty: "beginner" as const,
      language: "python",
    },
    {
      conceptName: "Dictionaries",
      title: "Invert a Dictionary",
      description: "Swap the keys and values of a dictionary. Assume all values are unique.",
      starterCode: "original = {\"a\": 1, \"b\": 2, \"c\": 3}\n# Create inverted dict where keys become values and vice versa\n\nprint(inverted)  # Should print: {1: 'a', 2: 'b', 3: 'c'}",
      solutionCode: "original = {\"a\": 1, \"b\": 2, \"c\": 3}\ninverted = {}\nfor key, value in original.items():\n    inverted[value] = key\nprint(inverted)",
      hints: ["Use .items() to iterate over key-value pairs", "Swap them when adding to the new dictionary"],
      testCases: [{ input: "", expectedOutput: "{1: 'a', 2: 'b', 3: 'c'}" }],
      difficulty: "intermediate" as const,
      language: "python",
    },

    // ─── JavaScript Exercises ──────────────────────────────────

    // ── Variables (3 JS exercises) ──
    {
      conceptName: "Variables",
      title: "Swap Two Variables (JS)",
      description: "Swap the values of two variables without a temporary variable using JavaScript.",
      starterCode: "let a = 5;\nlet b = 10;\n// Swap a and b below\n\nconsole.log(a, b);  // Should print: 10 5",
      solutionCode: "let a = 5;\nlet b = 10;\n[a, b] = [b, a];\nconsole.log(a, b);",
      hints: ["Think about destructuring assignment", "JavaScript allows you to swap with [a, b] = [b, a]"],
      testCases: [{ input: "", expectedOutput: "10 5" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Variables",
      title: "Name and Age (JS)",
      description: "Create variables for your name and age, then print a greeting using JavaScript.",
      starterCode: "// Create name and age variables\n\n// Print: Hello, I'm [name] and I'm [age] years old!",
      solutionCode: "let name = \"Alex\";\nlet age = 10;\nconsole.log(`Hello, I'm ${name} and I'm ${age} years old!`);",
      hints: ["Use let or const for variable declaration", "Use template literals with backticks"],
      testCases: [{ input: "", expectedOutput: "Hello, I'm Alex and I'm 10 years old!" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Variables",
      title: "Temperature Converter (JS)",
      description: "Store a temperature in Celsius in a variable, convert it to Fahrenheit (F = C * 9/5 + 32), and print both values.",
      starterCode: "const celsius = 25;\n// Convert to Fahrenheit and print both\n",
      solutionCode: "const celsius = 25;\nconst fahrenheit = celsius * 9/5 + 32;\nconsole.log(`${celsius}C = ${fahrenheit}F`);",
      hints: ["Use the formula F = C * 9/5 + 32", "Store the result in a new variable"],
      testCases: [{ input: "", expectedOutput: "25C = 77F" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },

    // ── Data Types (3 JS exercises) ──
    {
      conceptName: "Data Types",
      title: "Type Detective (JS)",
      description: "Create one variable of each type (number, string, boolean) and print each variable's type using typeof.",
      starterCode: "// Create variables of different types\n\n// Print the type of each variable\n",
      solutionCode: "const myNum = 42;\nconst myStr = \"hello\";\nconst myBool = true;\nconsole.log(typeof myNum);\nconsole.log(typeof myStr);\nconsole.log(typeof myBool);",
      hints: ["Create variables of different types", "Use the typeof operator to check"],
      testCases: [{ input: "", expectedOutput: "number\nstring\nboolean" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Data Types",
      title: "String to Number (JS)",
      description: "Convert the string '42' to a number and the string '3.14' to a float. Print the sum of both.",
      starterCode: "const textInt = \"42\";\nconst textFloat = \"3.14\";\n// Convert to numbers and print their sum\n",
      solutionCode: "const textInt = \"42\";\nconst textFloat = \"3.14\";\nconst numInt = parseInt(textInt);\nconst numFloat = parseFloat(textFloat);\nconsole.log(numInt + numFloat);",
      hints: ["Use parseInt() to convert to integer", "Use parseFloat() to convert to float"],
      testCases: [{ input: "", expectedOutput: "45.14" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Data Types",
      title: "Type Checker (JS)",
      description: "Write code that checks if a value is a string. If it is, print its length. If it's a number, print its double.",
      starterCode: "const value = \"hello\";\n// Check the type and print accordingly\n// If string: print length\n// If number: print double\n",
      solutionCode: "const value = \"hello\";\nif (typeof value === 'string') {\n    console.log(value.length);\n} else if (typeof value === 'number') {\n    console.log(value * 2);\n}",
      hints: ["Use typeof to check types", "Strings have a .length property"],
      testCases: [{ input: "", expectedOutput: "5" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },

    // ── Operators (3 JS exercises) ──
    {
      conceptName: "Operators",
      title: "Simple Calculator (JS)",
      description: "Given two numbers, print the result of adding, subtracting, multiplying, and dividing them.",
      starterCode: "const a = 15;\nconst b = 4;\n// Print the result of +, -, *, / for a and b\n",
      solutionCode: "const a = 15;\nconst b = 4;\nconsole.log(a + b);\nconsole.log(a - b);\nconsole.log(a * b);\nconsole.log(a / b);",
      hints: ["Use +, -, *, / operators", "Print each result on a new line"],
      testCases: [{ input: "", expectedOutput: "19\n11\n60\n3.75" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Operators",
      title: "Remainder and Floor (JS)",
      description: "Use the modulo (%) and floor division operators. Given a number of minutes, print the hours and remaining minutes.",
      starterCode: "const totalMinutes = 135;\n// Calculate hours and remaining minutes\n// Print: 135 minutes = 2 hours and 15 minutes\n",
      solutionCode: "const totalMinutes = 135;\nconst hours = Math.floor(totalMinutes / 60);\nconst minutes = totalMinutes % 60;\nconsole.log(`${totalMinutes} minutes = ${hours} hours and ${minutes} minutes`);",
      hints: ["Use Math.floor() for floor division", "Use % (modulo) to get remaining minutes"],
      testCases: [{ input: "", expectedOutput: "135 minutes = 2 hours and 15 minutes" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Operators",
      title: "Comparison Chain (JS)",
      description: "Given three numbers, use comparison operators to determine and print the largest one without using Math.max().",
      starterCode: "const x = 7;\nconst y = 15;\nconst z = 10;\n// Find and print the largest number using comparisons\n",
      solutionCode: "const x = 7;\nconst y = 15;\nconst z = 10;\nif (x >= y && x >= z) {\n    console.log(x);\n} else if (y >= x && y >= z) {\n    console.log(y);\n} else {\n    console.log(z);\n}",
      hints: ["Use >= operators to compare", "Use if/else if/else statements"],
      testCases: [{ input: "", expectedOutput: "15" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },

    // ── Conditionals (3 JS exercises) ──
    {
      conceptName: "Conditionals",
      title: "Even or Odd (JS)",
      description: "Write a program that checks if a number is even or odd.",
      starterCode: "const number = 7;\n// Check if number is even or odd\n",
      solutionCode: "const number = 7;\nif (number % 2 === 0) {\n    console.log(\"even\");\n} else {\n    console.log(\"odd\");\n}",
      hints: ["Use % (modulo) to check remainder", "If remainder is 0, it's even"],
      testCases: [{ input: "", expectedOutput: "odd" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Conditionals",
      title: "Grade Calculator (JS)",
      description: "Convert a numeric score to a letter grade (A/B/C/D/F).",
      starterCode: "const score = 85;\n// Convert to letter grade\n// A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: below 60\n",
      solutionCode: "const score = 85;\nif (score >= 90) {\n    console.log('A');\n} else if (score >= 80) {\n    console.log('B');\n} else if (score >= 70) {\n    console.log('C');\n} else if (score >= 60) {\n    console.log('D');\n} else {\n    console.log('F');\n}",
      hints: ["Use multiple if/else if/else statements", "Check ranges in order from highest to lowest"],
      testCases: [{ input: "", expectedOutput: "B" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Conditionals",
      title: "Leap Year (JS)",
      description: "Check if a given year is a leap year. A leap year is divisible by 4, but not by 100 — unless also divisible by 400.",
      starterCode: "const year = 2024;\n// Determine if it's a leap year and print the result\n",
      solutionCode: "const year = 2024;\nif (year % 400 === 0) {\n    console.log(\"leap\");\n} else if (year % 100 === 0) {\n    console.log(\"not leap\");\n} else if (year % 4 === 0) {\n    console.log(\"leap\");\n} else {\n    console.log(\"not leap\");\n}",
      hints: ["Check divisibility by 400 first", "Then check 100, then 4"],
      testCases: [{ input: "", expectedOutput: "leap" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },

    // ── Loops (3 JS exercises) ──
    {
      conceptName: "Loops",
      title: "Sum 1 to N (JS)",
      description: "Calculate the sum of all numbers from 1 to N.",
      starterCode: "const n = 10;\nlet total = 0;\n// Add numbers 1 to n\n\nconsole.log(total);  // Should print: 55",
      solutionCode: "const n = 10;\nlet total = 0;\nfor (let i = 1; i <= n; i++) {\n    total += i;\n}\nconsole.log(total);",
      hints: ["Use a for loop", "Add each number to the total"],
      testCases: [{ input: "", expectedOutput: "55" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Loops",
      title: "FizzBuzz (JS)",
      description: "Print FizzBuzz for numbers 1-20.",
      starterCode: "// For each number 1-20:\n// Print 'Fizz' if divisible by 3\n// Print 'Buzz' if divisible by 5\n// Print 'FizzBuzz' if divisible by both\n// Otherwise print the number\n",
      solutionCode: "for (let i = 1; i <= 20; i++) {\n    if (i % 15 === 0) {\n        console.log('FizzBuzz');\n    } else if (i % 3 === 0) {\n        console.log('Fizz');\n    } else if (i % 5 === 0) {\n        console.log('Buzz');\n    } else {\n        console.log(i);\n    }\n}",
      hints: ["Check divisibility by 15 first (for FizzBuzz)", "Use else if for the other conditions"],
      testCases: [{ input: "", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Loops",
      title: "Multiplication Table (JS)",
      description: "Print the multiplication table for a given number (1 through 10).",
      starterCode: "const num = 7;\n// Print the multiplication table for num\n// Example: 7 x 1 = 7, 7 x 2 = 14, ...\n",
      solutionCode: "const num = 7;\nfor (let i = 1; i <= 10; i++) {\n    console.log(`${num} x ${i} = ${num * i}`);\n}",
      hints: ["Use a for loop from 1 to 10", "Use template literals to print nicely"],
      testCases: [{ input: "", expectedOutput: "7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },

    // ── Functions (3 JS exercises) ──
    {
      conceptName: "Functions",
      title: "Factorial (JS)",
      description: "Write a function that calculates the factorial of a number.",
      starterCode: "function factorial(n) {\n    // Your code here\n}\n\nconsole.log(factorial(5));  // Should print: 120",
      solutionCode: "function factorial(n) {\n    if (n === 0 || n === 1) return 1;\n    let result = 1;\n    for (let i = 2; i <= n; i++) {\n        result *= i;\n    }\n    return result;\n}\n\nconsole.log(factorial(5));",
      hints: ["Factorial of n = n × (n-1) × ... × 1", "0! = 1 and 1! = 1"],
      testCases: [{ input: "", expectedOutput: "120" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Functions",
      title: "Palindrome Check (JS)",
      description: "Write a function to check if a string is a palindrome.",
      starterCode: "function isPalindrome(text) {\n    // Your code here\n}\n\nconsole.log(isPalindrome(\"racecar\"));  // true\nconsole.log(isPalindrome(\"hello\"));    // false",
      solutionCode: "function isPalindrome(text) {\n    const cleaned = text.toLowerCase().replace(/\\s/g, '');\n    return cleaned === cleaned.split('').reverse().join('');\n}\n\nconsole.log(isPalindrome(\"racecar\"));\nconsole.log(isPalindrome(\"hello\"));",
      hints: ["Reverse the string and compare", "Use split('').reverse().join('')"],
      testCases: [{ input: "", expectedOutput: "true\nfalse" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Functions",
      title: "Power Function (JS)",
      description: "Write a function that calculates base raised to the power of exp without using ** or Math.pow().",
      starterCode: "function power(base, exp) {\n    // Your code here\n}\n\nconsole.log(power(2, 10));  // Should print: 1024\nconsole.log(power(3, 4));   // Should print: 81",
      solutionCode: "function power(base, exp) {\n    let result = 1;\n    for (let i = 0; i < exp; i++) {\n        result *= base;\n    }\n    return result;\n}\n\nconsole.log(power(2, 10));\nconsole.log(power(3, 4));",
      hints: ["Multiply base by itself exp times", "Use a loop to repeat the multiplication"],
      testCases: [{ input: "", expectedOutput: "1024\n81" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },

    // ── Lists (3 JS exercises) ──
    {
      conceptName: "Lists",
      title: "Find Maximum (JS)",
      description: "Find the largest number in an array without using Math.max().",
      starterCode: "const numbers = [3, 7, 2, 8, 1, 9, 4];\n// Find the maximum without using Math.max()\n\nconsole.log(maximum);  // Should print: 9",
      solutionCode: "const numbers = [3, 7, 2, 8, 1, 9, 4];\nlet maximum = numbers[0];\nfor (let num of numbers) {\n    if (num > maximum) {\n        maximum = num;\n    }\n}\nconsole.log(maximum);",
      hints: ["Start with the first element", "Compare each element and update if larger"],
      testCases: [{ input: "", expectedOutput: "9" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Lists",
      title: "Reverse an Array (JS)",
      description: "Reverse an array in place without using the built-in reverse() method.",
      starterCode: "const items = [1, 2, 3, 4, 5];\n// Reverse items in place\n\nconsole.log(items);  // Should print: [5, 4, 3, 2, 1]",
      solutionCode: "const items = [1, 2, 3, 4, 5];\nfor (let i = 0; i < items.length / 2; i++) {\n    const j = items.length - 1 - i;\n    [items[i], items[j]] = [items[j], items[i]];\n}\nconsole.log(items);",
      hints: ["Swap elements from both ends", "Move towards the middle"],
      testCases: [{ input: "", expectedOutput: "[5, 4, 3, 2, 1]" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Lists",
      title: "Remove Duplicates (JS)",
      description: "Remove duplicate values from an array while keeping the original order.",
      starterCode: "const numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];\n// Remove duplicates, keep order\n\nconsole.log(unique);  // Should print: [3, 1, 4, 5, 9, 2, 6]",
      solutionCode: "const numbers = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];\nconst unique = [];\nfor (let num of numbers) {\n    if (!unique.includes(num)) {\n        unique.push(num);\n    }\n}\nconsole.log(unique);",
      hints: ["Use a new array to store unique values", "Use includes() to check if element exists"],
      testCases: [{ input: "", expectedOutput: "[3, 1, 4, 5, 9, 2, 6]" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },

    // ── Dictionaries/Objects (3 JS exercises) ──
    {
      conceptName: "Dictionaries",
      title: "Word Counter (JS)",
      description: "Count how many times each word appears in a sentence using an object.",
      starterCode: "const sentence = \"the cat sat on the mat the cat\";\n// Count each word's occurrences\n\nconsole.log(counts);  // Should show each word and its count",
      solutionCode: "const sentence = \"the cat sat on the mat the cat\";\nconst words = sentence.split(' ');\nconst counts = {};\nfor (let word of words) {\n    if (word in counts) {\n        counts[word]++;\n    } else {\n        counts[word] = 1;\n    }\n}\nconsole.log(counts);",
      hints: ["Use split() to break sentence into words", "Use an object to track counts"],
      testCases: [{ input: "", expectedOutput: "{the: 3, cat: 2, sat: 1, on: 1, mat: 1}" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
    {
      conceptName: "Dictionaries",
      title: "Phone Book (JS)",
      description: "Create a phone book object. Add three contacts, look up one, and print all contacts.",
      starterCode: "const phoneBook = {};\n// Add contacts: Alice=555-1234, Bob=555-5678, Carol=555-9012\n// Look up Bob's number\n// Print all contacts\n",
      solutionCode: "const phoneBook = {};\nphoneBook[\"Alice\"] = \"555-1234\";\nphoneBook[\"Bob\"] = \"555-5678\";\nphoneBook[\"Carol\"] = \"555-9012\";\nconsole.log(phoneBook[\"Bob\"]);\nconsole.log(phoneBook);",
      hints: ["Use key:value pairs in objects", "Access values using bracket notation"],
      testCases: [{ input: "", expectedOutput: "555-5678\n{Alice: '555-1234', Bob: '555-5678', Carol: '555-9012'}" }],
      difficulty: "beginner" as const,
      language: "javascript",
    },
    {
      conceptName: "Dictionaries",
      title: "Invert an Object (JS)",
      description: "Swap the keys and values of an object. Assume all values are unique.",
      starterCode: "const original = {\"a\": 1, \"b\": 2, \"c\": 3};\n// Create inverted object where keys become values and vice versa\n\nconsole.log(inverted);  // Should print: {1: 'a', 2: 'b', 3: 'c'}",
      solutionCode: "const original = {\"a\": 1, \"b\": 2, \"c\": 3};\nconst inverted = {};\nfor (let key in original) {\n    inverted[original[key]] = key;\n}\nconsole.log(inverted);",
      hints: ["Use for...in loop to iterate over object keys", "Swap them when adding to the new object"],
      testCases: [{ input: "", expectedOutput: "{1: 'a', 2: 'b', 3: 'c'}" }],
      difficulty: "intermediate" as const,
      language: "javascript",
    },
  ];

  for (const ex of exercises) {
    const conceptId = conceptMap.get(ex.conceptName);
    if (!conceptId) continue;
    const { conceptName, ...exData } = ex;
    const deterministicId = conceptId + "-ex-" + exData.title.toLowerCase().replace(/\s+/g, "-");
    const record = await prisma.exercise.upsert({
      where: { id: deterministicId },
      update: {
        title: exData.title,
        description: exData.description,
        starterCode: exData.starterCode,
        difficulty: exData.difficulty,
        language: exData.language,
        solutionCode: exData.solutionCode || null,
        hints: exData.hints || [],
        testCases: exData.testCases || [],
      },
      create: {
        id: deterministicId,
        title: exData.title,
        description: exData.description,
        starterCode: exData.starterCode,
        difficulty: exData.difficulty,
        language: exData.language,
        solutionCode: exData.solutionCode || null,
        hints: exData.hints || [],
        testCases: exData.testCases || [],
        conceptTags: [conceptName.toLowerCase()],
      },
    });

    const lesson = lessonRecords.find((l) => l.conceptName === conceptName);
    if (lesson) {
      await prisma.lesson_Exercise.upsert({
        where: { lessonId_exerciseId: { lessonId: lesson.id, exerciseId: record.id } },
        update: {},
        create: { lessonId: lesson.id, exerciseId: record.id },
      });
    }
  }
}

export async function runSeed(prisma: PrismaClient): Promise<{
  users: number;
  concepts: number;
  lessons: number;
  exercises: number;
}> {
  await seedUsers(prisma);
  const conceptMap = await seedConcepts(prisma);
  const lessonRecords = await seedLessons(prisma, conceptMap);
  await seedExercises(prisma, conceptMap, lessonRecords);

  await prisma.executionJob.deleteMany({});
  await prisma.masteryRecord.deleteMany({});

  return {
    users: await prisma.user.count(),
    concepts: await prisma.concept.count(),
    lessons: await prisma.lesson.count(),
    exercises: await prisma.exercise.count(),
  };
}
