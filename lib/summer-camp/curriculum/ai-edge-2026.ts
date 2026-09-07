/**
 * AI & Edge Computing — Modules 0–11 curriculum blocks.
 * Seeded via scripts/seed-ai-edge-curriculum.mjs
 */

import { FACE_EYE_DETECTION_DEMO } from "./face-eye-detection-code"

export type CurriculumBlock = {
  block_type: string
  content: Record<string, unknown>
  sort_order: number
}

export type CurriculumModule = {
  title: string
  description: string
  sort_order: number
  blocks: CurriculumBlock[]
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", content: { prompt }, sort_order: sort }
}

function fb(question: string, sort: number, kind = "clarity"): CurriculumBlock {
  return { block_type: "feedback", content: { question, kind }, sort_order: sort }
}

function conf(sort: number): CurriculumBlock {
  return {
    block_type: "confidence",
    content: { question: "How confident are you in this topic? (1 = lost, 5 = expert)" },
    sort_order: sort,
  }
}

export const AI_EDGE_2026_MODULES: CurriculumModule[] = [
  {
    title: "Module 0 — Welcome to the AI & Edge Computing Summer Camp",
    description:
      "Onboarding mission: understand the project, meet instructors, set expectations, and get excited to build.",
    sort_order: 0,
    blocks: [
      {
        block_type: "hero",
        sort_order: 0,
        content: {
          title: "AI & Edge Computing Summer Camp 2026",
          subtitle: "Build Real AI Systems on Real Hardware",
        },
      },
      {
        block_type: "callout",
        sort_order: 1,
        content: {
          variant: "tip",
          text: "Estimated time: 20–30 minutes · Difficulty: Beginner · Module goal: understand what you'll build, why it matters, and complete onboarding.",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          variant: "welcome_intro",
        },
      },
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "start_journey", title: "Start My Journey" },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "## What Will We Build?\n\nImagine a **smart security camera**.\n\nA normal camera records everything. An AI camera can:\n\n- Detect people\n- Count vehicles\n- Identify objects\n- Send alerts\n\n…without needing a human to watch the screen.\n\n**How?** That is exactly what we will learn.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: { variant: "demo_flow", title: "Interactive Demonstration" },
      },
      {
        block_type: "image_gallery",
        sort_order: 6,
        content: {
          cards: [
            {
              title: "Tesla Vehicle",
              description: "Autonomous perception",
              imageUrl: "/summer-camp/module-0/autonomous-vehicle.png",
            },
            {
              title: "Smart Traffic Camera",
              description: "Urban monitoring",
              imageUrl: "/summer-camp/module-0/smart-traffic-camera.png",
            },
            {
              title: "Amazon Warehouse Robot",
              description: "Object handling",
              imageUrl: "/summer-camp/module-0/warehouse-robot.png",
            },
            {
              title: "Agricultural Drone",
              description: "Crop analysis",
              imageUrl: "/summer-camp/module-0/agricultural-drone.png",
            },
            {
              title: "Smart Factory Camera",
              description: "Quality control",
              imageUrl: "/summer-camp/module-0/smart-factory-camera.png",
            },
            {
              title: "Smart Home Security",
              description: "Real-time alerts",
              imageUrl: "/summer-camp/module-0/smart-home-security.png",
            },
          ],
        },
      },
      {
        block_type: "reflection",
        sort_order: 7,
        content: {
          prompt: "Which application interests you most?",
          options: [
            "Self-driving cars",
            "Security systems",
            "Robotics",
            "Healthcare",
            "Smart cities",
            "Drones",
          ],
          saveToProfile: true,
          profileKey: "favoriteApplication",
        },
      },
      {
        block_type: "faculty_cards",
        sort_order: 8,
        content: {
          faculty: [
            {
              name: "Dr. Daniel Doe",
              role: "Camp Director · Prairie View A&M University",
              interests: "Edge AI, Embedded Systems, Computer Engineering",
              funFact: "Leads the CREDIT Center AI & Edge Computing Summer Camp.",
            },
          ],
          assistants: [
            {
              name: "Stabak Das",
              role: "Teaching Assistant · Prairie View A&M University",
              funFact: "Supports campers through Raspberry Pi setup and TensorFlow Lite labs.",
            },
          ],
        },
      },
      {
        block_type: "video",
        sort_order: 9,
        content: { title: "Message from Faculty (1–2 min)", url: null },
      },
      {
        block_type: "mission_objectives",
        sort_order: 10,
        content: {
          missions: [
            { title: "Understand AI", xp: 25 },
            { title: "Understand Edge Computing", xp: 25 },
            { title: "Learn Raspberry Pi", xp: 50 },
            { title: "Build Object Detection System", xp: 100 },
            { title: "Complete Final Demonstration", xp: 200 },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "roadmap_map", title: "Your Mission Journey" },
      },
      {
        block_type: "text",
        sort_order: 12,
        content: {
          markdown:
            "## Camp Expectations\n\n### What We Expect From You\n\n- Participate actively\n- Ask questions\n- Work with your teammates\n- Complete activities\n- Have fun learning\n\n### What We Do NOT Expect\n\nYou do **NOT** need programming experience, AI experience, Linux experience, or hardware experience. We will teach everything step-by-step.",
        },
      },
      {
        block_type: "profile_form",
        sort_order: 13,
        content: {
          title: "Icebreaker — Tell Us About Yourself",
          fields: [
            { key: "name", label: "Name" },
            { key: "school", label: "School" },
            { key: "gradeLevel", label: "Grade Level" },
            { key: "careerInterest", label: "Career Interest" },
            { key: "favoriteTechnology", label: "Favorite Technology" },
            { key: "favoriteAiApplication", label: "Favorite AI Application" },
            { key: "dreamAiSystem", label: "If you could build ANY AI system, what would it be?", type: "textarea" },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 14,
        content: {
          title: "AI Around You",
          prompt: "How many AI systems have you used today? Select all that apply:",
          options: [
            "Google Maps",
            "YouTube",
            "Netflix",
            "TikTok",
            "Siri",
            "Alexa",
            "ChatGPT",
            "Spotify",
            "Instagram",
            "Snapchat",
          ],
          activityType: "poll",
          multiSelect: true,
          revealMessage: "Surprise! You have probably already used AI dozens of times today.",
        },
      },
      {
        block_type: "text",
        sort_order: 15,
        content: {
          markdown:
            "## Camp Community\n\nHere's how to get help:\n\n- **Ask questions** in the discussion thread below\n- **Upload screenshots** when you're stuck on hardware or code\n- **Contact instructors** via Support or discussion mentions\n- **Reply to threads** to help classmates — we're one camp team",
        },
      },
      {
        block_type: "activity",
        sort_order: 16,
        content: {
          title: "Create Your First Discussion Post",
          prompt: "Introduce yourself to the camp. Say your name, your school, and something interesting about yourself.",
          activityType: "first_discussion",
        },
      },
      kc("Knowledge Check — Module 0", [
        {
          id: "q1",
          prompt: "What will be the main project in this camp?",
          options: [
            "Mobile App Development",
            "Website Design",
            "Object Detection on Raspberry Pi",
            "Video Editing",
          ],
          correctIndex: 2,
        },
        {
          id: "q2",
          prompt: "True/False: AI is used in self-driving cars.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Which technologies will we learn?",
          options: ["AI", "Edge Computing", "Raspberry Pi", "Computer Vision", "Accounting"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "What type of device is Raspberry Pi?",
          options: ["Smartphone", "Edge Computer", "Monitor", "Router"],
          correctIndex: 1,
        },
        {
          id: "q5",
          prompt: "True/False: You must already know AI before joining this camp.",
          options: ["True", "False"],
          correctIndex: 1,
          trueFalse: true,
        },
      ], 17),
      {
        block_type: "feedback",
        sort_order: 18,
        content: {
          kind: "excitement",
          question: "How excited are you about this camp?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 19,
        content: {
          title: "🎉 Congratulations!",
          message: "You have completed Module 0.",
          rewards: { xp: 50, badges: ["welcome-badge", "camp-explorer"], nextModule: "Module 1 — What is Artificial Intelligence?" },
        },
      },
    ],
  },
  {
    title: "Module 1 — What is Artificial Intelligence?",
    description:
      "Define AI, distinguish it from traditional software, explore real-world applications, and connect to the camp capstone.",
    sort_order: 1,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 30–45 minutes · Difficulty: Beginner · XP Reward: 100 XP · Badge: AI Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "#### Learning Objectives\n\nBy the end of this module you will:\n\n- Define Artificial Intelligence\n- Identify AI applications in everyday life\n- Distinguish AI from traditional software\n- Understand how AI learns from data\n- Recognize why AI is transforming industries",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown:
            "## Opening Challenge: Can You Spot the AI?\n\nBefore we explain AI… let's see how much AI you **already use**.",
        },
      },
      {
        block_type: "activity",
        sort_order: 3,
        content: {
          title: "Which of these technologies use AI?",
          prompt: "Select all that apply, then submit:",
          options: [
            "Google Maps",
            "YouTube Recommendations",
            "Netflix",
            "Siri",
            "Alexa",
            "Face Unlock",
            "ChatGPT",
            "Tesla Autopilot",
            "Instagram Feed",
            "Spotify",
          ],
          activityType: "poll",
          multiSelect: true,
          revealTitle: "Correct Answer: ALL OF THEM",
          revealMessage: "🎉 Surprise! You probably interacted with AI dozens of times today.",
        },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "## The World Before AI\n\nImagine you own a large online store.\n\nEvery day:\n\n- 1 million customers visit\n- 100,000 products are viewed\n- 10,000 purchases occur\n\n**Question:** How would you decide which products to recommend?\n\nCould a human manually analyze millions of customer actions every day? **No.**\n\nThis is where AI becomes useful.",
        },
      },
      {
        block_type: "activity",
        sort_order: 5,
        content: {
          title: "Which task would be hardest for a human?",
          prompt: "Pick one — then see the answer:",
          options: [
            "Recommending products to millions of users",
            "Detecting objects in thousands of videos",
            "Translating millions of sentences",
            "Driving through city traffic",
          ],
          activityType: "poll",
          multiSelect: false,
          revealTitle: "Answer: All are difficult at scale",
          revealMessage: "At millions of users, videos, or miles — humans cannot keep up. AI handles scale.",
        },
      },
      {
        block_type: "text",
        sort_order: 6,
        content: {
          markdown:
            "## What is Artificial Intelligence?\n\n**Artificial Intelligence (AI)** is the ability of computers to perform tasks that normally require human intelligence.\n\nThese tasks include:\n\n- Recognizing images\n- Understanding speech\n- Making predictions\n- Solving problems\n- Learning from experience",
        },
      },
      {
        block_type: "interactive",
        sort_order: 7,
        content: {
          variant: "comparison_table",
          rows: [
            { human: "Learns from experience", ai: "Learns from data" },
            { human: "Recognizes faces", ai: "Detects faces" },
            { human: "Understands speech", ai: "Speech recognition" },
            { human: "Makes decisions", ai: "Predictive models" },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: {
          variant: "matching",
          title: "Match the task to the AI capability",
          prompt: "Tap each row to reveal the match.",
          pairs: [
            { task: "Recognize Face", capability: "Computer Vision" },
            { task: "Understand Speech", capability: "Speech Recognition" },
            { task: "Translate Languages", capability: "Natural Language Processing" },
            { task: "Recommend Movies", capability: "Recommendation Systems" },
            { task: "Drive a Vehicle", capability: "Autonomous Systems" },
          ],
        },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown:
            "## AI Is Not Magic\n\nMany people think AI is magic. **It is not.**\n\nAI learns **patterns from data**.\n\nSuppose we show a computer:\n\n- 10,000 pictures of cats\n- 10,000 pictures of dogs\n\nEventually it learns cats have certain patterns and dogs have different patterns. The computer learns to distinguish between them.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "training_demo", title: "Training → Model → Prediction" },
      },
      {
        block_type: "reflection",
        sort_order: 11,
        content: {
          prompt: "What happens if we train the model using poor quality data?",
          hint: "Expected idea: Poor data leads to poor AI performance.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 12,
        content: {
          variant: "industry_sectors",
          sectors: [
            {
              title: "Healthcare",
              examples: ["Cancer detection", "Medical imaging", "Patient monitoring"],
              imageUrl: "/summer-camp/shared/ai-healthcare.png",
            },
            {
              title: "Transportation",
              examples: ["Self-driving cars", "Traffic prediction", "Route optimization"],
              imageUrl: "/summer-camp/shared/ai-transportation.png",
            },
            {
              title: "Agriculture",
              examples: ["Crop monitoring", "Disease detection", "Smart irrigation"],
              imageUrl: "/summer-camp/shared/ai-agriculture.png",
            },
            {
              title: "Smart Cities",
              examples: ["Traffic management", "Public safety", "Energy optimization"],
              imageUrl: "/summer-camp/shared/ai-smart-city.png",
            },
            {
              title: "Robotics",
              examples: ["Warehouse robots", "Delivery robots", "Manufacturing systems"],
              imageUrl: "/summer-camp/shared/ai-robotics.png",
            },
          ],
        },
      },
      {
        block_type: "reflection",
        sort_order: 13,
        content: {
          prompt: "Which AI application interests you most?",
          options: ["Healthcare", "Transportation", "Agriculture", "Smart Cities", "Robotics", "Security"],
          saveToProfile: true,
          profileKey: "module1FavoriteApplication",
        },
      },
      {
        block_type: "text",
        sort_order: 14,
        content: {
          markdown:
            "## Traditional Programming vs AI\n\nThis is one of the most important concepts in the camp.\n\n### Traditional Programming\n\nThe programmer writes rules.\n\n**Input + Rules → Computer → Output**\n\nExamples: Calculator, traffic light timer, temperature converter.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 15,
        content: {
          variant: "programming_traditional",
          example: "Calculator, Traffic Light Timer, Temperature Converter",
        },
      },
      {
        block_type: "text",
        sort_order: 16,
        content: {
          markdown:
            "### AI Programming\n\nInstead of giving rules, we give **examples**.\n\n**Data + Answers → Training → AI Model → Predictions**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 17,
        content: { variant: "programming_ml" },
      },
      reflect("Why is AI useful for difficult tasks like image recognition?", 18),
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "ai_hierarchy", title: "The Three Levels of AI We Will Learn" },
      },
      {
        block_type: "callout",
        sort_order: 20,
        content: {
          variant: "tip",
          text: "Camp Connection: Our final project uses Deep Learning for Object Detection on a Raspberry Pi Edge Device. Everything you learn from this point forward contributes directly to your final project.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 21,
        content: {
          variant: "industry_spotlight",
          companies: [
            { name: "Tesla", uses: ["Object detection", "Lane detection", "Obstacle avoidance"] },
            { name: "Amazon", uses: ["Warehouse robots", "Product recommendations"] },
            { name: "Netflix", uses: ["Content recommendations"] },
            { name: "OpenAI", uses: ["ChatGPT", "Language understanding"] },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 22,
        content: {
          title: "If you became an AI engineer tomorrow, which area would you choose?",
          prompt: "Select one:",
          options: ["Robotics", "Healthcare", "Transportation", "Space Exploration", "Gaming", "Cybersecurity"],
          activityType: "poll",
          multiSelect: false,
        },
      },
      kc("Knowledge Check — Artificial Intelligence", [
        {
          id: "q1",
          prompt: "Artificial Intelligence allows computers to perform tasks that normally require:",
          options: ["Electricity", "Human Intelligence", "Internet Access", "Sensors"],
          correctIndex: 1,
        },
        {
          id: "q2",
          prompt: "True or False: AI learns patterns from data.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all AI applications:",
          options: ["Face Recognition", "Speech Recognition", "Recommendation Systems", "Autonomous Vehicles", "Flashlight"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "Which is a subset of AI?",
          options: ["Deep Learning", "Machine Learning", "Both A and B", "Neither"],
          correctIndex: 2,
        },
        {
          id: "q5",
          prompt: "True or False: AI is magic.",
          options: ["True", "False"],
          correctIndex: 1,
          trueFalse: true,
        },
      ], 23),
      {
        block_type: "reflection",
        sort_order: 24,
        content: {
          prompt:
            "Mini Challenge: You are designing a smart campus. Choose one problem AI could solve (e.g. parking, security, traffic, classroom occupancy). Describe your idea.",
        },
      },
      {
        block_type: "feedback",
        sort_order: 25,
        content: {
          kind: "module_reflection",
          interestingPrompt: "What was the most interesting thing you learned?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 26,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Module 1: Artificial Intelligence",
          rewards: {
            xp: 100,
            badges: ["ai-explorer"],
            nextModule: "Module 2 — Machine Learning and Deep Learning",
          },
        },
      },
    ],
  },
  {
    title: "Module 2 — Machine Learning and Deep Learning",
    description:
      "Understand data, training, prediction, and how Deep Learning powers modern AI — connected to object detection.",
    sort_order: 2,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 125 XP · Badge: Machine Learning Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what Machine Learning is\n- Understand the role of data\n- Understand training and prediction\n- Differentiate AI, Machine Learning, and Deep Learning\n- Understand why Deep Learning powers modern AI systems\n- Connect Machine Learning to our Object Detection project",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown:
            "## Opening Challenge: How Do Humans Learn?\n\nBefore we talk about machines… let's talk about **you**.",
        },
      },
      {
        block_type: "quiz",
        sort_order: 3,
        content: {
          title: "How did you learn to recognize a dog?",
          questions: [
            {
              id: "q1",
              prompt: "How did you learn to recognize a dog?",
              options: [
                "Someone programmed your brain",
                "You memorized every dog",
                "You saw many examples over time",
                "You read a manual",
              ],
              correctIndex: 2,
            },
          ],
        },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "As children we learn from **examples**. The more examples we see — dogs, cats, cars, trees — the better we become at recognizing them.\n\n**Machine Learning works similarly.**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: {
          variant: "pattern_gallery",
          title: "10 Different Dogs",
          question: "How did your brain know these are all dogs even though they look different?",
          count: 10,
          revealTitle: "You learned patterns.",
          revealMessage: "Machine Learning does the same thing.",
        },
      },
      {
        block_type: "text",
        sort_order: 6,
        content: {
          markdown:
            "## What is Machine Learning?\n\n**Machine Learning (ML)** is a branch of AI that allows computers to learn patterns from data instead of being explicitly programmed.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 7,
        content: { variant: "programming_traditional", example: "Rules + Data → Computer → Answer" },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "programming_ml" },
      },
      {
        block_type: "interactive",
        sort_order: 9,
        content: { variant: "ml_compare", title: "Calculator vs Photo Recognition" },
      },
      reflect("Why would writing rules for every image be impossible?", 10),
      {
        block_type: "text",
        sort_order: 11,
        content: {
          markdown:
            "## What is Data?\n\nEverything starts with **data**. Without data: no learning, no AI, no Machine Learning.\n\nExamples: Images, Videos, Text, Audio, Sensor Readings, Medical Records, Traffic Data",
        },
      },
      {
        block_type: "interactive",
        sort_order: 12,
        content: {
          variant: "data_types_gallery",
          items: [
            { label: "Dog Photo", emoji: "🐕" },
            { label: "Voice Recording", emoji: "🎤" },
            { label: "Weather Sensor", emoji: "🌡️" },
            { label: "Traffic Camera", emoji: "📷" },
            { label: "Social Media Post", emoji: "📱" },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 13,
        content: {
          title: "Classify the data type",
          prompt: "Select all that are valid ML data types:",
          options: ["Image", "Text", "Audio", "Sensor", "Video"],
          activityType: "poll",
          multiSelect: true,
          revealMessage: "All of these can be training data for machine learning models.",
        },
      },
      {
        block_type: "callout",
        sort_order: 14,
        content: {
          variant: "tip",
          text: "Camp Connection: Our project uses Camera Images as the data source for object detection on Raspberry Pi.",
        },
      },
      {
        block_type: "text",
        sort_order: 15,
        content: {
          markdown:
            "## How Does a Machine Learn?\n\nImagine teaching a child. You show: Cat, Cat, Cat, Cat, Dog, Dog, Dog, Dog. Eventually the child learns.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 16,
        content: {
          variant: "vertical_pipeline",
          title: "Machine Learning Process",
          steps: ["Collect Data", "Label Data", "Train Model", "Test Model", "Make Predictions"],
        },
      },
      {
        block_type: "interactive",
        sort_order: 17,
        content: {
          variant: "vertical_pipeline",
          title: "Training Pipeline",
          steps: ["Images", "Labels", "Training", "Model", "Prediction"],
        },
      },
      {
        block_type: "interactive",
        sort_order: 18,
        content: {
          variant: "step_order",
          title: "Arrange the ML steps in correct order",
          correctOrder: ["Collect Data", "Label Data", "Train Model", "Test Model", "Make Predictions"],
        },
      },
      {
        block_type: "text",
        sort_order: 19,
        content: {
          markdown:
            "## Understanding Training\n\nTraining is the learning phase. The model studies thousands or millions of examples.\n\n**Example:** Teach a computer to recognize apples with 10,000 apple images and 10,000 non-apple images.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 20,
        content: { variant: "training_loop", title: "During Training" },
      },
      {
        block_type: "interactive",
        sort_order: 21,
        content: { variant: "training_simulation", title: "Training Simulation" },
      },
      reflect("Why does practice improve performance?", 22),
      {
        block_type: "text",
        sort_order: 23,
        content: {
          markdown: "## Understanding Predictions\n\nTraining is over. Now the model must make decisions on **new** data it has never seen.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 24,
        content: { variant: "prediction_flow" },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: { variant: "prediction_challenge" },
      },
      {
        block_type: "callout",
        sort_order: 26,
        content: {
          variant: "tip",
          text: "Prediction is what happens after learning. This is exactly what our final object detection project does on the Raspberry Pi.",
        },
      },
      {
        block_type: "text",
        sort_order: 27,
        content: {
          markdown:
            "## What Makes Deep Learning Different?\n\nMachine Learning became powerful. **Deep Learning** made it revolutionary.\n\n**Analogy:** Machine Learning = learning with notes. Deep Learning = learning with a giant library.\n\nDeep Learning uses **artificial neural networks** inspired by the human brain. It can learn from images, speech, language, video, and complex patterns.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 28,
        content: { variant: "brain_network" },
      },
      {
        block_type: "callout",
        sort_order: 29,
        content: {
          variant: "warning",
          text: "Key Insight: Deep Learning is why ChatGPT, self-driving cars, and modern object detection exist.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 30,
        content: {
          variant: "dl_applications",
          applications: [
            { title: "Face Recognition", emoji: "😊" },
            { title: "Voice Assistants", emoji: "🎙️" },
            { title: "Self-Driving Cars", emoji: "🚗" },
            { title: "Medical Imaging", emoji: "🏥" },
            { title: "Object Detection", emoji: "🎯" },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 31,
        content: {
          variant: "matching",
          title: "Match application to Deep Learning task",
          pairs: [
            { task: "Face Unlock", capability: "Image Recognition" },
            { task: "ChatGPT", capability: "Language Processing" },
            { task: "Tesla", capability: "Computer Vision" },
            { task: "Alexa", capability: "Speech Recognition" },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 32,
        content: { variant: "ai_hierarchy", title: "AI vs ML vs DL" },
      },
      {
        block_type: "text",
        sort_order: 33,
        content: {
          markdown:
            "### AI vs ML vs DL\n\n- **Artificial Intelligence** — the big field\n- **Machine Learning** — a way for computers to learn from data\n- **Deep Learning** — a powerful ML technique using neural networks",
        },
      },
      {
        block_type: "callout",
        sort_order: 34,
        content: {
          variant: "tip",
          text: "Camp Connection: AI → Deep Learning → Computer Vision → Object Detection → Raspberry Pi Edge Device",
        },
      },
      {
        block_type: "interactive",
        sort_order: 35,
        content: {
          variant: "project_architecture",
          title: "Interactive Architecture",
          steps: [
            "Artificial Intelligence",
            "Deep Learning",
            "Object Detection",
            "Camera",
            "Raspberry Pi",
            "Detected Object",
          ],
        },
      },
      {
        block_type: "text",
        sort_order: 36,
        content: {
          markdown:
            "## Real-World Engineering Challenge\n\nA farmer wants to detect diseased crops automatically.\n\n**Would Machine Learning help?** Yes — with labeled images of healthy and diseased crops.",
        },
      },
      {
        block_type: "quiz",
        sort_order: 37,
        content: {
          title: "Farmer Challenge",
          questions: [
            {
              id: "q1",
              prompt: "Would Machine Learning help detect diseased crops?",
              options: ["Yes", "No"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 38,
        content: {
          title: "What data would we need?",
          prompt: "Select all that apply:",
          options: [
            "Images of healthy crops",
            "Images of diseased crops",
            "Movie reviews",
            "Music files",
          ],
          activityType: "poll",
          multiSelect: true,
          revealMessage: "We need labeled crop images — not unrelated text or audio data.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 39,
        content: {
          variant: "mini_project",
          title: "Mini Project — Design Your Own AI System",
          profileKey: "miniProjectMl",
        },
      },
      kc("Knowledge Check — Machine Learning & Deep Learning", [
        {
          id: "q1",
          prompt: "Machine Learning allows computers to:",
          options: ["Learn from data", "Learn from electricity", "Learn from keyboards", "Learn from monitors"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Data is required for Machine Learning.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all examples of data:",
          options: ["Images", "Text", "Audio", "Video", "Sensor Data"],
          correctIndices: [0, 1, 2, 3, 4],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "What happens during training?",
          options: [
            "The model learns patterns",
            "The computer shuts down",
            "The monitor changes color",
            "The internet speeds up",
          ],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "Deep Learning is:",
          options: [
            "Larger than AI",
            "A subset of Machine Learning",
            "A type of monitor",
            "A programming language",
          ],
          correctIndex: 1,
        },
      ], 40),
      {
        block_type: "feedback",
        sort_order: 41,
        content: {
          kind: "module_reflection",
          sentencePrompt: "Complete the sentence: Today I learned that Machine Learning...",
          confusingOptions: ["Data", "Training", "Prediction", "Deep Learning", "AI vs ML vs DL"],
          confidenceLabel: "How confident do you feel about Machine Learning now?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 42,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Machine Learning & Deep Learning",
          rewards: {
            xp: 125,
            badges: ["ml-explorer"],
            nextModule: "Module 3 — Computer Vision",
            comingNext:
              "How computers actually see and understand images — the foundation of object detection.",
          },
        },
      },
    ],
  },
  {
    title: "Module 3 — Computer Vision & Image Understanding",
    description:
      "How computers see images, the three CV tasks, object detection deep dive, and connection to the Raspberry Pi capstone.",
    sort_order: 3,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 150 XP · Badge: Computer Vision Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what Computer Vision is\n- Understand how computers represent images\n- Distinguish Classification, Detection, and Segmentation\n- Recognize Computer Vision applications\n- Understand Object Detection\n- Connect Computer Vision to our Raspberry Pi project",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: { markdown: "## Opening Challenge: Can Computers See?" },
      },
      {
        block_type: "quiz",
        sort_order: 3,
        content: {
          title: "Can a computer look at an image the same way humans do?",
          questions: [
            {
              id: "q1",
              prompt: "Can a computer look at an image the same way humans do?",
              options: ["Yes", "No", "Not Exactly"],
              correctIndex: 2,
            },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 4,
        content: { variant: "vision_observe", objects: ["Dog", "Person", "Car", "Tree", "Traffic Light"] },
      },
      {
        block_type: "text",
        sort_order: 5,
        content: {
          markdown:
            "## What is Computer Vision?\n\n**Computer Vision** is a field of Artificial Intelligence that enables computers to understand and interpret visual information from images and videos.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 6,
        content: { variant: "vision_pipeline_compare" },
      },
      {
        block_type: "callout",
        sort_order: 7,
        content: {
          variant: "warning",
          text: "Computers do not see dogs, people, cars, or trees. Computers see numbers — lots of numbers.",
        },
      },
      {
        block_type: "quiz",
        sort_order: 8,
        content: {
          title: "What is an image made of?",
          questions: [
            { id: "q1", prompt: "What is an image made of?", options: ["Shapes", "Pixels", "Lines", "Objects"], correctIndex: 1 },
          ],
        },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown:
            "### What is a Pixel?\n\nA **pixel** is the smallest unit of an image. Thousands or millions of pixels combine to form an image.\n\n### RGB\n\nEach pixel contains **Red**, **Green**, and **Blue** values.\n\nExample: R=255, G=0, B=0 → **Red**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "pixel_zoom" },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "rgb_tool" },
      },
      reflect("How many pixels might a smartphone image contain?", 12),
      {
        block_type: "interactive",
        sort_order: 13,
        content: { variant: "dog_matrix" },
      },
      {
        block_type: "interactive",
        sort_order: 14,
        content: { variant: "cv_feature_pipeline" },
      },
      {
        block_type: "interactive",
        sort_order: 15,
        content: { variant: "cat_dog_compare" },
      },
      {
        block_type: "text",
        sort_order: 16,
        content: {
          markdown:
            "## Three Major Computer Vision Tasks\n\nUnderstanding these tasks is critical — our final project uses **Object Detection**.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 17,
        content: { variant: "cv_tasks" },
      },
      {
        block_type: "interactive",
        sort_order: 18,
        content: { variant: "bounding_box_demo" },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "segmentation_demo" },
      },
      {
        block_type: "interactive",
        sort_order: 20,
        content: { variant: "task_sort", title: "Drag examples into the correct task" },
      },
      {
        block_type: "text",
        sort_order: 21,
        content: {
          markdown:
            "## Object Detection Deep Dive\n\nObject Detection identifies **what** object exists **and where** it exists in the image.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 22,
        content: { variant: "detection_scores" },
      },
      {
        block_type: "interactive",
        sort_order: 23,
        content: { variant: "detection_viewer" },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown:
            "### Why is object location important?\n\n- **Security** — know where intruders are\n- **Robotics** — navigate around obstacles\n- **Autonomous vehicles** — avoid pedestrians and vehicles\n- **Agriculture** — locate diseased plants in a field",
        },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: {
          variant: "od_use_cases",
          sectors: [
            {
              title: "Smart Cities",
              examples: ["Traffic monitoring", "Pedestrian counting", "Parking detection"],
              imageUrl: "/summer-camp/shared/od-smart-city.png",
            },
            {
              title: "Self-Driving Cars",
              examples: ["Vehicles", "Pedestrians", "Traffic signs", "Lane detection"],
              imageUrl: "/summer-camp/shared/od-self-driving.png",
            },
            {
              title: "Healthcare",
              examples: ["Tumor detection", "Medical imaging"],
              imageUrl: "/summer-camp/shared/od-healthcare.png",
            },
            {
              title: "Agriculture",
              examples: ["Crop monitoring", "Disease detection", "Fruit counting"],
              imageUrl: "/summer-camp/shared/od-agriculture.png",
            },
            {
              title: "Robotics",
              examples: ["Object tracking", "Navigation", "Obstacle avoidance"],
              imageUrl: "/summer-camp/shared/od-robotics.png",
            },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 26,
        content: {
          title: "Which industry would you use Object Detection in?",
          prompt: "Select one:",
          options: ["Smart Cities", "Self-Driving Cars", "Healthcare", "Agriculture", "Robotics", "Security"],
          activityType: "poll",
          multiSelect: false,
        },
      },
      {
        block_type: "interactive",
        sort_order: 27,
        content: {
          variant: "project_architecture",
          title: "From Camera to Intelligence",
          steps: [
            "Raspberry Pi Camera",
            "Image Capture",
            "TensorFlow Lite Model",
            "Object Detection",
            "Bounding Boxes",
            "Display Results",
          ],
        },
      },
      {
        block_type: "callout",
        sort_order: 28,
        content: {
          variant: "tip",
          text: "Camp Connection: Everything you are learning now will soon run on a Raspberry Pi. You are building a real Edge AI system.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 29,
        content: { variant: "human_vs_ai" },
      },
      {
        block_type: "interactive",
        sort_order: 30,
        content: {
          variant: "vision_design",
          title: "Mini Design Challenge — Design Your AI Camera",
          profileKey: "visionSystemDesign",
        },
      },
      kc("Knowledge Check — Computer Vision", [
        {
          id: "q1",
          prompt: "Computer Vision allows computers to:",
          options: ["Understand images and videos", "Improve internet speed", "Increase battery life", "Replace cameras"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Images are made of pixels.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all Computer Vision applications.",
          options: ["Face Recognition", "Object Detection", "Medical Imaging", "Autonomous Vehicles"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "Which task identifies object locations?",
          options: ["Classification", "Object Detection", "Segmentation", "Compression"],
          correctIndex: 1,
        },
        {
          id: "q5",
          prompt: "True or False: Object Detection is used in self-driving vehicles.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 31),
      {
        block_type: "feedback",
        sort_order: 32,
        content: {
          kind: "module_reflection",
          sentencePrompt: "What surprised you most about Computer Vision?",
          confusingOptions: ["Pixels", "RGB", "Classification", "Detection", "Segmentation"],
          confidenceLabel: "How confident do you feel about Computer Vision now?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 33,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Computer Vision & Image Understanding",
          rewards: {
            xp: 150,
            badges: ["cv-explorer"],
            nextModule: "Module 4 — Internet of Things (IoT)",
            comingNext:
              "How billions of devices communicate and create the connected world that makes Edge Computing possible.",
          },
        },
      },
    ],
  },
  {
    title: "Module 4 — Internet of Things (IoT)",
    description:
      "Connected devices, sensors, data explosion, and why Edge Computing becomes necessary — bridge to Module 5.",
    sort_order: 4,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 150 XP · Badge: IoT Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what IoT is\n- Identify common IoT devices\n- Understand sensors and data collection\n- Understand how IoT systems communicate\n- Recognize real-world IoT applications\n- Understand why IoT creates huge amounts of data\n- Understand why Edge Computing becomes necessary",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown: "## Opening Challenge\n\n**How many connected devices are around you?**\n\nBefore we begin… look around the room.",
        },
      },
      {
        block_type: "activity",
        sort_order: 3,
        content: {
          title: "Select every connected device you can see",
          prompt: "Select all that apply:",
          options: [
            "Smartphone",
            "Smart TV",
            "Smart Watch",
            "Laptop",
            "Tablet",
            "Security Camera",
            "Gaming Console",
            "Smart Speaker",
            "WiFi Router",
            "Smart Thermostat",
            "Other",
          ],
          activityType: "poll",
          multiSelect: true,
          revealTitle: "Internet of Things (IoT)",
          revealMessage:
            "Most people interact with dozens of connected devices every day. By 2030 there will be tens of billions worldwide. This connected world is called the Internet of Things (IoT).",
        },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "## What is IoT?\n\nThe **Internet of Things (IoT)** is a network of physical devices that collect, exchange, and act on data through the internet or local networks.\n\n**Traditional Internet:** People communicate with people.\n\n**IoT:** Devices communicate with devices.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: { variant: "iot_network_flow" },
      },
      {
        block_type: "callout",
        sort_order: 6,
        content: {
          variant: "tip",
          text: "Many IoT devices operate automatically without human intervention.",
        },
      },
      {
        block_type: "text",
        sort_order: 7,
        content: {
          markdown: "## The Building Blocks of IoT\n\nEvery IoT system contains four major components: **Sensors**, **Connectivity**, **Processing**, and **Action**.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "iot_components" },
      },
      {
        block_type: "interactive",
        sort_order: 9,
        content: {
          variant: "sensor_gallery",
          sensors: [
            { name: "Camera Sensor", emoji: "📷", data: "Images" },
            { name: "Temperature", emoji: "🌡️", data: "Heat data" },
            { name: "Motion", emoji: "🏃", data: "Movement" },
            { name: "GPS", emoji: "📍", data: "Location" },
            { name: "Microphone", emoji: "🎤", data: "Audio" },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "sensor_match", title: "Match sensor to data type" },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "connectivity_match" },
      },
      {
        block_type: "callout",
        sort_order: 12,
        content: {
          variant: "warning",
          text: "Processing: Where should data be analyzed — on device, in the cloud, or both? We'll answer that in this module and Module 5.",
        },
      },
      {
        block_type: "text",
        sort_order: 13,
        content: {
          markdown:
            "### Action\n\nThe system responds: turn on a light, send an alert, detect an object, open a gate, recommend a route.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 14,
        content: { variant: "iot_system_flow" },
      },
      {
        block_type: "activity",
        sort_order: 15,
        content: {
          title: "Where should analysis happen?",
          prompt: "For a security camera detecting intruders:",
          options: ["On the device (edge)", "In the cloud", "Both (hybrid)"],
          activityType: "poll",
          multiSelect: false,
          revealMessage: "Great thinking! We'll explore why edge vs cloud matters in the next sections.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 16,
        content: {
          variant: "iot_applications",
          sectors: [
            {
              title: "Smart Homes",
              examples: ["Smart lights", "Smart cameras", "Thermostats", "Voice assistants"],
              imageUrl: "/summer-camp/shared/iot-smart-home.png",
            },
            {
              title: "Smart Cities",
              examples: ["Traffic monitoring", "Parking systems", "Environmental monitoring", "Public safety"],
              imageUrl: "/summer-camp/shared/iot-smart-city.png",
            },
            {
              title: "Healthcare",
              examples: ["Wearable devices", "Remote monitoring", "Heart rate tracking"],
              imageUrl: "/summer-camp/shared/iot-healthcare.png",
            },
            {
              title: "Agriculture",
              examples: ["Soil sensors", "Drone monitoring", "Smart irrigation", "Livestock tracking"],
              imageUrl: "/summer-camp/shared/iot-agriculture.png",
            },
            {
              title: "Industry",
              examples: ["Factories", "Robots", "Predictive maintenance", "Asset tracking"],
              imageUrl: "/summer-camp/shared/iot-industry.png",
            },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 17,
        content: {
          title: "Which IoT application interests you most?",
          prompt: "Select one:",
          options: ["Smart Homes", "Smart Cities", "Healthcare", "Agriculture", "Industry"],
          activityType: "poll",
          multiSelect: false,
        },
      },
      {
        block_type: "text",
        sort_order: 18,
        content: {
          markdown:
            "## The Data Explosion Problem\n\nImagine **10 smart cameras** recording video continuously.\n\nHow much data is generated? **An enormous amount.**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "data_explosion" },
      },
      {
        block_type: "activity",
        sort_order: 20,
        content: {
          title: "Can all this data be sent to the cloud? What problems might occur?",
          prompt: "Select all that apply:",
          options: ["Slow response", "High bandwidth usage", "Privacy concerns", "Higher costs"],
          activityType: "poll",
          multiSelect: true,
          revealTitle: "Key Insight",
          revealMessage: "IoT generates huge amounts of data. This creates new challenges — and leads us to Edge Computing.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 21,
        content: { variant: "edge_choice" },
      },
      {
        block_type: "callout",
        sort_order: 22,
        content: {
          variant: "tip",
          text: "Camp Connection: Our Raspberry Pi is an Edge Device. It can process data locally — it does not always need the cloud. Next module: Edge Computing.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 23,
        content: { variant: "iot_ai_pipeline" },
      },
      {
        block_type: "interactive",
        sort_order: 24,
        content: { variant: "iot_ai_examples" },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: {
          variant: "iot_system_builder",
          title: "Build Your Own IoT System",
          profileKey: "iotSystemDesign",
        },
      },
      kc("Knowledge Check — Internet of Things", [
        {
          id: "q1",
          prompt: "What does IoT stand for?",
          options: ["Internet of Things", "Internet of Technology", "Intelligent Online Tools", "Integrated Object Technology"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: IoT devices can collect data using sensors.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all examples of IoT devices.",
          options: ["Smart Watch", "Smart Thermostat", "Security Camera", "Smart Speaker"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "Which component collects information?",
          options: ["Sensor", "Router", "Cloud", "Screen"],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "True or False: IoT systems can generate large amounts of data.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 26),
      {
        block_type: "feedback",
        sort_order: 27,
        content: {
          kind: "module_reflection",
          sentencePrompt: "What IoT device do you use most often?",
          secondaryPrompt: "What surprised you most about IoT?",
          confidenceLabel: "How well do you understand IoT?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 28,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Internet of Things (IoT)",
          rewards: {
            xp: 150,
            badges: ["iot-explorer"],
            nextModule: "Module 5 — Edge Computing",
            comingNext:
              "Why sending everything to the cloud is not always a good idea and how Edge Computing solves this problem.",
          },
        },
      },
    ],
  },
  {
    title: "Module 5 — Edge Computing",
    description:
      "Cloud limitations, latency, bandwidth, privacy, edge benefits, Raspberry Pi as edge device, and why our capstone uses Edge AI.",
    sort_order: 5,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 175 XP · Badge: Edge Computing Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what Edge Computing is\n- Understand the limitations of cloud computing\n- Understand latency, bandwidth, and privacy concerns\n- Recognize Edge Computing applications\n- Understand why Raspberry Pi is an Edge Device\n- Understand why our final project uses Edge AI",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown:
            "## Opening Challenge: The Self-Driving Car Problem\n\nA child suddenly runs into the road.\n\n**Option A:** Send image to cloud → wait for response → then brake.\n\n**Option B:** Process image immediately → brake instantly.\n\nEvery millisecond matters.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "edge_choice" },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "## The Cloud Computing World\n\nBefore Edge Computing, most processing happened in the **cloud**.\n\n**Cloud computing** means data is sent to remote servers (Google Cloud, AWS, Azure) for storage and processing.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: { variant: "cloud_flow" },
      },
      {
        block_type: "interactive",
        sort_order: 6,
        content: { variant: "cloud_benefits" },
      },
      reflect("Do you think every application should depend on the cloud?", 7),
      {
        block_type: "text",
        sort_order: 8,
        content: {
          markdown:
            "## The Problem with Sending Everything to the Cloud\n\nImagine **1 million smart cameras** streaming video continuously.",
        },
      },
      {
        block_type: "activity",
        sort_order: 9,
        content: {
          title: "What problems might occur?",
          prompt: "Select all that apply:",
          options: ["Slow response", "Network congestion", "High cost", "Privacy concerns", "Internet dependency"],
          activityType: "poll",
          multiSelect: true,
          revealTitle: "All of these are real problems",
          revealMessage: "The cloud becomes overloaded when IoT scales to millions of devices.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "data_explosion" },
      },
      {
        block_type: "text",
        sort_order: 11,
        content: {
          markdown:
            "## Understanding Latency\n\n**Latency** is the delay between sending data and receiving a response.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 12,
        content: { variant: "latency_workflow" },
      },
      {
        block_type: "interactive",
        sort_order: 13,
        content: { variant: "latency_demo" },
      },
      {
        block_type: "activity",
        sort_order: 14,
        content: {
          title: "Would a 2-second delay matter in these systems?",
          prompt: "Select all where delay is critical:",
          options: ["Self-driving vehicles", "Medical monitoring", "Industrial robots", "Security systems"],
          activityType: "poll",
          multiSelect: true,
          revealMessage: "Absolutely — in all of these, every millisecond can matter.",
        },
      },
      {
        block_type: "text",
        sort_order: 15,
        content: {
          markdown:
            "## Edge Computing to the Rescue\n\n**Edge Computing** moves computation closer to where data is generated. Processing occurs near the source instead of a distant cloud server.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 16,
        content: { variant: "cloud_vs_edge" },
      },
      {
        block_type: "interactive",
        sort_order: 17,
        content: { variant: "edge_benefits" },
      },
      {
        block_type: "interactive",
        sort_order: 18,
        content: { variant: "edge_benefit_match" },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "edge_applications" },
      },
      {
        block_type: "activity",
        sort_order: 20,
        content: {
          title: "Which Edge application is most exciting to you?",
          prompt: "Select one:",
          options: [
            "Smart Security Cameras",
            "Self-Driving Vehicles",
            "Smart Agriculture",
            "Healthcare Devices",
            "Industrial Automation",
          ],
          activityType: "poll",
          multiSelect: false,
        },
      },
      {
        block_type: "text",
        sort_order: 21,
        content: {
          markdown:
            "## What is an Edge Device?\n\nAn **Edge Device** is hardware that collects data and processes it locally.\n\nExamples: Smart Camera, Drone, Robot, Industrial Controller, Smartphone, **Raspberry Pi**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 22,
        content: { variant: "edge_device_gallery" },
      },
      {
        block_type: "callout",
        sort_order: 23,
        content: {
          variant: "tip",
          text: "Which device will we use in this camp? Raspberry Pi — your Edge AI platform.",
        },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown:
            "## Meet Your Edge Device: Raspberry Pi\n\n**Why Raspberry Pi?** Small · Affordable · Energy efficient · Powerful enough for AI · Easy to program · Large community",
        },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: { variant: "pi_hardware_preview" },
      },
      {
        block_type: "callout",
        sort_order: 26,
        content: {
          variant: "warning",
          text: "Camp Connection: Our final project runs on a Raspberry Pi — not in a cloud server. You are building Edge AI.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 27,
        content: { variant: "cloud_edge_sort" },
      },
      {
        block_type: "interactive",
        sort_order: 28,
        content: { variant: "edge_journey" },
      },
      {
        block_type: "callout",
        sort_order: 29,
        content: {
          variant: "tip",
          text: "Realization: Our project is an Edge AI System combining Computer Vision, Deep Learning, IoT, and Edge Computing — not just object detection.",
        },
      },
      kc("Knowledge Check — Edge Computing", [
        {
          id: "q1",
          prompt: "What is Edge Computing?",
          options: [
            "Processing data closer to where it is generated",
            "Processing only in the cloud",
            "Storing data forever",
            "Internet browsing",
          ],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Latency is a delay in communication.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all benefits of Edge Computing.",
          options: ["Lower Latency", "Better Privacy", "Reduced Bandwidth", "Improved Reliability"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "Which is an Edge Device?",
          options: ["Raspberry Pi", "Monitor", "Keyboard", "Speaker"],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "True or False: Our final project uses Edge AI.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 30),
      {
        block_type: "feedback",
        sort_order: 31,
        content: {
          kind: "module_reflection",
          sentencePrompt: "Complete the sentence: Edge Computing is important because...",
          benefitOptions: ["Privacy", "Speed", "Reliability", "Lower Bandwidth"],
          confidenceLabel: "How confident do you feel about Edge Computing?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 32,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Edge Computing",
          rewards: {
            xp: 175,
            badges: ["edge-explorer"],
            nextModule: "Module 6 — AI at the Edge",
            comingNext:
              "How Artificial Intelligence and Edge Computing work together to create smart cameras, drones, robots, and real-world intelligent systems.",
          },
        },
      },
    ],
  },
  {
    title: "Module 6 — AI at the Edge",
    description:
      "Edge AI definition, system architecture, real-world applications, TensorFlow Lite, capstone pipeline, and smart campus design.",
    sort_order: 6,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner–Intermediate · XP Reward: 200 XP · Badge: Edge AI Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what Edge AI is\n- Understand how AI and Edge Computing work together\n- Understand Edge AI system architecture\n- Recognize real-world Edge AI applications\n- Understand why Edge AI is growing rapidly\n- Understand the complete architecture of our final project\n- Be prepared to begin working with Raspberry Pi hardware",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown:
            "## Opening Challenge: Meet the Smart Camera\n\n**Traditional camera:** Records video. Stores video. Nothing more.\n\n**Smart camera:** Detects people, vehicles, packages, and suspicious activity — **without sending video to the cloud**.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "smart_camera_poll" },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "## What is Edge AI?\n\n**Edge AI** combines **Artificial Intelligence** and **Edge Computing** to allow intelligent decisions directly on local devices.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: { variant: "edge_ai_formula" },
      },
      reflect("Would you trust a smart camera more if it processed your data locally?", 6),
      {
        block_type: "text",
        sort_order: 7,
        content: {
          markdown:
            "## The Evolution of Intelligent Systems\n\n**Generation 1 — Traditional Devices:** Only collect data (basic cameras, simple sensors, thermometers).\n\n**Generation 2 — Cloud AI:** Collect → send to cloud → AI processing → receive response.\n\n**Generation 3 — Edge AI:** Collect → process locally → decide immediately.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "intelligence_evolution" },
      },
      {
        block_type: "callout",
        sort_order: 9,
        content: {
          variant: "tip",
          text: "Discussion: Which generation is best for Autonomous Vehicles? Edge AI — every millisecond matters.",
        },
      },
      {
        block_type: "text",
        sort_order: 10,
        content: {
          markdown: "## Anatomy of an Edge AI System\n\nEvery Edge AI system contains: **Sensor**, **Edge Device**, **AI Model**, and **Decision Engine**.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "edge_ai_architecture" },
      },
      {
        block_type: "interactive",
        sort_order: 12,
        content: {
          variant: "iot_applications",
          sectors: [
            {
              title: "Smart Security Cameras",
              examples: ["People", "Vehicles", "Intrusions", "Packages"],
              imageUrl: "/summer-camp/shared/od-security.png",
            },
            {
              title: "Self-Driving Vehicles",
              examples: ["Pedestrians", "Traffic Signs", "Vehicles", "Obstacles"],
              imageUrl: "/summer-camp/shared/od-self-driving.png",
            },
            {
              title: "Smart Agriculture",
              examples: ["Plant Diseases", "Crop Health", "Animal Activity"],
              imageUrl: "/summer-camp/shared/od-agriculture.png",
            },
            {
              title: "Healthcare Monitoring",
              examples: ["Abnormal Heart Activity", "Patient Emergencies", "Health Trends"],
              imageUrl: "/summer-camp/shared/edge-healthcare-device.png",
            },
            {
              title: "Industrial Automation",
              examples: ["Equipment Failures", "Safety Violations", "Production Defects"],
              imageUrl: "/summer-camp/shared/iot-industry.png",
            },
          ],
        },
      },
      {
        block_type: "activity",
        sort_order: 13,
        content: {
          title: "Which Edge AI application would you most like to build?",
          prompt: "Select one:",
          options: [
            "Smart Security Camera",
            "Self-Driving Vehicle",
            "Smart Agriculture Monitor",
            "Healthcare Device",
            "Industrial Automation",
          ],
          activityType: "poll",
          multiSelect: false,
        },
      },
      {
        block_type: "text",
        sort_order: 14,
        content: {
          markdown:
            "## Why Edge AI Is Difficult\n\nEdge devices are smaller than cloud servers. Why doesn't every device run AI?",
        },
      },
      {
        block_type: "interactive",
        sort_order: 15,
        content: { variant: "edge_ai_challenges" },
      },
      {
        block_type: "interactive",
        sort_order: 16,
        content: { variant: "cloud_vs_pi" },
      },
      {
        block_type: "text",
        sort_order: 17,
        content: {
          markdown:
            "## Edge AI in Our Summer Camp Project\n\n**Our Goal:** Build an Edge AI Object Detection System.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 18,
        content: { variant: "capstone_pipeline" },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "capstone_steps" },
      },
      {
        block_type: "callout",
        sort_order: 20,
        content: {
          variant: "warning",
          text: "Key Insight: This entire process occurs locally on the Raspberry Pi — no cloud required.",
        },
      },
      {
        block_type: "text",
        sort_order: 21,
        content: {
          markdown:
            "## Meet TensorFlow Lite\n\nLarge AI models require huge memory, GPUs, and massive computation. **TensorFlow Lite** is designed for mobile devices, embedded systems, edge devices, and Raspberry Pi.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 22,
        content: { variant: "tflite_compare" },
      },
      {
        block_type: "callout",
        sort_order: 23,
        content: {
          variant: "tip",
          text: "Camp Connection: TensorFlow Lite is the AI framework we will install on the Raspberry Pi.",
        },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown:
            "## Edge AI Challenge\n\nYou are designing a **smart campus**. Choose an Edge AI application and define your system.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: {
          variant: "edge_ai_design",
          title: "Design Your Smart Campus Edge AI System",
          profileKey: "edgeAiProjectConcept",
        },
      },
      {
        block_type: "text",
        sort_order: 26,
        content: {
          markdown: "## Future of Edge AI\n\nEmerging areas: smart robots, smart factories, drones, wearables, mixed reality, autonomous vehicles, and space exploration.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 27,
        content: { variant: "edge_ai_future" },
      },
      {
        block_type: "activity",
        sort_order: 28,
        content: {
          title: "Which future Edge AI technology excites you most?",
          prompt: "Select one:",
          options: [
            "Smart Robots",
            "Smart Factories",
            "Drones",
            "Wearables",
            "Mixed Reality",
            "Autonomous Vehicles",
            "Space Exploration",
          ],
          activityType: "poll",
          multiSelect: false,
        },
      },
      kc("Knowledge Check — AI at the Edge", [
        {
          id: "q1",
          prompt: "Edge AI combines:",
          options: ["AI and Edge Computing", "AI and Databases", "AI and Networking", "AI and Graphics"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Edge AI processes data locally.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Select all Edge AI components.",
          options: ["Sensor", "Edge Device", "AI Model", "Decision Engine"],
          correctIndices: [0, 1, 2, 3],
          multiSelect: true,
        },
        {
          id: "q4",
          prompt: "Which device will we use in this camp?",
          options: ["Raspberry Pi", "Smartphone", "Laptop", "Router"],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "True or False: TensorFlow Lite is designed for Edge Devices.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 29),
      {
        block_type: "feedback",
        sort_order: 30,
        content: {
          kind: "module_reflection",
          sentencePrompt: "Complete the sentence: Edge AI is powerful because...",
          confusingPrompt: "Which concept is still unclear?",
          confusingOptions: ["Edge Devices", "AI Models", "TensorFlow Lite", "System Architecture", "Real-World Applications"],
          confidenceLabel: "How confident do you feel about Edge AI?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 31,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed AI at the Edge",
          rewards: {
            xp: 200,
            badges: ["edge-ai-explorer"],
            nextModule: "Module 7 — Meet the Raspberry Pi",
            comingNext:
              "You will finally get hands-on with the hardware that powers your Edge AI system and learn how each component contributes to real-world intelligent computing.",
          },
        },
      },
    ],
  },
  {
    title: "Module 7 — Meet the Raspberry Pi",
    description:
      "Pi hardware components, edge device role, camera module, ecosystem, safety, and full project architecture preview.",
    sort_order: 7,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 200 XP · Badge: Raspberry Pi Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand what Raspberry Pi is\n- Identify Raspberry Pi hardware components\n- Understand the role of each component\n- Understand how Raspberry Pi functions as an Edge Device\n- Understand how Raspberry Pi connects to sensors and cameras\n- Understand how Raspberry Pi fits into our final Edge AI project",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown: "## Opening Challenge: Can a Tiny Computer Run AI?",
        },
      },
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "pi_hero" },
      },
      {
        block_type: "interactive",
        sort_order: 4,
        content: { variant: "pi_ai_poll" },
      },
      {
        block_type: "text",
        sort_order: 5,
        content: {
          markdown:
            "## What is Raspberry Pi?\n\nRaspberry Pi is a **low-cost single-board computer** designed for learning, experimentation, and building real-world systems.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 6,
        content: { variant: "desktop_vs_pi" },
      },
      {
        block_type: "activity",
        sort_order: 7,
        content: {
          title: "What do you think Raspberry Pi is most commonly used for?",
          prompt: "Select one:",
          options: ["Learning Programming", "Robotics", "Smart Devices", "AI Projects", "All of the Above"],
          activityType: "poll",
          multiSelect: false,
          revealTitle: "All of the Above",
          revealMessage: "Raspberry Pi is used for programming, robotics, smart devices, and AI projects worldwide.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "pi_why_love" },
      },
      reflect("Why do you think Raspberry Pi became popular in education?", 9),
      {
        block_type: "text",
        sort_order: 10,
        content: {
          markdown: "## Explore the Raspberry Pi Hardware\n\nClick each component to learn its role on the board.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "pi_hardware_explorer" },
      },
      {
        block_type: "interactive",
        sort_order: 12,
        content: { variant: "pi_component_match" },
      },
      {
        block_type: "text",
        sort_order: 13,
        content: {
          markdown:
            "## Raspberry Pi as an Edge Device\n\nRemember Module 5? **Edge Computing** means processing data close to where it is generated.\n\n**Can Raspberry Pi perform local processing?** YES.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 14,
        content: { variant: "pi_edge_diagram" },
      },
      reflect("Why might local processing be useful?", 15),
      {
        block_type: "interactive",
        sort_order: 16,
        content: { variant: "pi_real_world" },
      },
      {
        block_type: "activity",
        sort_order: 17,
        content: {
          title: "Which Raspberry Pi application would you build?",
          prompt: "Select one:",
          options: [
            "Smart Agriculture",
            "Smart Security",
            "Robotics",
            "Smart Home",
            "Industrial Monitoring",
          ],
          activityType: "poll",
          multiSelect: false,
        },
      },
      {
        block_type: "text",
        sort_order: 18,
        content: {
          markdown:
            "## Meet the Camera\n\nOur project requires visual information. The camera serves as the **eyes** of the system.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "camera_module" },
      },
      {
        block_type: "interactive",
        sort_order: 20,
        content: { variant: "camera_required_poll" },
      },
      {
        block_type: "callout",
        sort_order: 21,
        content: {
          variant: "tip",
          text: "Discussion: The camera provides the data. The AI provides the intelligence.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 22,
        content: { variant: "pi_ecosystem" },
      },
      {
        block_type: "interactive",
        sort_order: 23,
        content: {
          variant: "pi_setup_builder",
          title: "Build Your Raspberry Pi Setup",
          profileKey: "piSetupDesign",
          challenges: ["Smart Greenhouse", "Smart Security System"],
        },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown: "## Hardware Safety & Best Practices\n\nHandle Pi hardware carefully — safety first before hands-on work.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: { variant: "pi_safety" },
      },
      {
        block_type: "interactive",
        sort_order: 26,
        content: { variant: "pi_project_walkthrough" },
      },
      {
        block_type: "interactive",
        sort_order: 27,
        content: { variant: "pi_mission_preview" },
      },
      {
        block_type: "callout",
        sort_order: 28,
        content: {
          variant: "warning",
          text: "Excitement Moment: You are now one step away from building a real Edge AI system.",
        },
      },
      kc("Knowledge Check — Raspberry Pi", [
        {
          id: "q1",
          prompt: "What is Raspberry Pi?",
          options: ["Single-board computer", "Sensor", "Router", "Cloud Server"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Raspberry Pi can run AI applications.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Which component stores the operating system?",
          options: ["CPU", "RAM", "MicroSD Card", "HDMI Port"],
          correctIndex: 2,
        },
        {
          id: "q4",
          prompt: "Which component connects our camera?",
          options: ["USB Port", "HDMI Port", "Camera Connector", "Power Port"],
          correctIndex: 2,
        },
        {
          id: "q5",
          prompt: "True or False: Raspberry Pi is commonly used in Edge Computing applications.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 29),
      {
        block_type: "feedback",
        sort_order: 30,
        content: {
          kind: "module_reflection",
          interestingPrompt: "What surprised you most about Raspberry Pi?",
          confusingPrompt: "Which component do you understand least?",
          confusingOptions: ["CPU", "RAM", "Camera Port", "GPIO", "Storage"],
          confidenceLabel: "How confident do you feel about Raspberry Pi hardware?",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 31,
        content: {
          title: "🎉 Congratulations!",
          message: "You completed Meet the Raspberry Pi",
          rewards: {
            xp: 200,
            badges: ["pi-explorer"],
            nextModule: "Module 8 — Setting Up Your Raspberry Pi",
            comingNext:
              "Students will physically assemble, configure, and prepare their Raspberry Pi environment for AI deployment.",
          },
        },
      },
    ],
  },
  {
    title: "Module 8 — Setting Up Your Raspberry Pi",
    description:
      "Assemble hardware, install Raspberry Pi OS, configure settings, boot successfully, verify camera, and prepare for Computer Vision.",
    sort_order: 8,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 60–90 minutes · Difficulty: Beginner · XP Reward: 250 XP · Badge: 🏆 Edge Device Builder",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Assemble Raspberry Pi hardware\n- Install Raspberry Pi OS\n- Configure Raspberry Pi settings\n- Create a user account\n- Configure localization settings\n- Write Raspberry Pi OS to a MicroSD card\n- Boot a Raspberry Pi successfully\n- Verify camera functionality\n- Prepare the platform for Computer Vision applications",
        },
      },
      {
        block_type: "interactive",
        sort_order: 2,
        content: { variant: "pi_setup_mission" },
      },
      {
        block_type: "text",
        sort_order: 3,
        content: {
          markdown:
            "## Section 1 — Hardware Assembly & Preparation\n\nBefore installing software, verify that all required hardware is available.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 4,
        content: { variant: "hardware_inventory" },
      },
      {
        block_type: "text",
        sort_order: 5,
        content: {
          markdown:
            "### Hardware Verification\n\nThe image below shows the complete hardware kit required for this training.\n\n**What To Look For:** Compare the hardware on your desk to the hardware shown in the image.\n\n**Why This Matters:** Every component serves a purpose. Missing hardware can prevent later modules from functioning correctly.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 6,
        content: { variant: "hardware_kit_layout" },
      },
      {
        block_type: "text",
        sort_order: 7,
        content: {
          markdown:
            "### Camera Installation\n\nThe camera is the most important sensor for our Computer Vision projects.\n\n**What To Look For:**\n\n- Ribbon cable is fully inserted\n- Connector latch is closed\n- Cable orientation matches the image\n\n**Common Mistake:** Most camera problems occur because the ribbon cable is installed backwards or is not fully seated.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "camera_orientation" },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown:
            "### Final Hardware Assembly\n\nAfter connecting all components your setup should resemble the image below.\n\n**Student Action:** Compare your setup with the example image. Make any necessary adjustments before proceeding.",
        },
      },
      {
        block_type: "text",
        sort_order: 10,
        content: {
          markdown:
            "![Fully assembled Raspberry Pi setup with camera module connected](/summer-camp/ai-edge/photos/module-7/pi-with-camera.jpg)",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 11,
        content: {
          title: "Hardware Ready",
          description: "Upload a photo of your assembled Raspberry Pi system.",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "/summer-camp/ai-edge/photos/module-7/pi-with-camera.jpg",
          referenceLabel: "Camp demo — assembled Pi with camera",
        },
      },
      {
        block_type: "text",
        sort_order: 12,
        content: {
          markdown:
            "## Section 2 — Installing Raspberry Pi OS\n\nA Raspberry Pi cannot run programs until an operating system is installed.\n\nWe will use **Raspberry Pi Imager** to install Raspberry Pi OS onto the MicroSD card. The interactive guide below walks through Sections 2–5 with screenshots for each step.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 13,
        content: { variant: "pi_imager_workflow" },
      },
      {
        block_type: "callout",
        sort_order: 14,
        content: {
          variant: "tip",
          text: "🎉 Congratulations! When installation finishes, your Raspberry Pi operating system is ready.",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 15,
        content: {
          title: "Raspberry Pi OS Installed",
          description: "Upload a screenshot of the successful installation screen.",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "/summer-camp/ai-edge/photos/module-8/imager-write-complete.png",
          referenceLabel: "Camp demo — Write complete screen",
        },
      },
      {
        block_type: "text",
        sort_order: 16,
        content: {
          markdown:
            "## Section 6 — First Boot & Camera Verification\n\nInsert the MicroSD card into the Raspberry Pi and connect power.\n\n### First Boot — Expected Results\n\n✓ Red Power LED\n\n✓ Green Activity LED\n\n✓ Raspberry Pi Desktop Appears\n\n✓ Mouse and Keyboard Respond",
        },
      },
      {
        block_type: "text",
        sort_order: 17,
        content: {
          markdown:
            "### Camera Verification\n\nBefore we begin Computer Vision programming, we must confirm the camera is functioning properly.\n\n#### Detect Connected Cameras\n\nOpen Terminal and run:",
        },
      },
      {
        block_type: "code",
        sort_order: 18,
        content: {
          language: "bash",
          code: "rpicam-hello --list-cameras",
        },
      },
      {
        block_type: "text",
        sort_order: 19,
        content: {
          markdown:
            "**What To Look For:** The Raspberry Pi should display information about the connected camera.\n\n**Why This Matters:** If the camera appears in the list, Raspberry Pi can communicate with the hardware successfully.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 20,
        content: { variant: "camera_verify" },
      },
      {
        block_type: "text",
        sort_order: 21,
        content: {
          markdown: "#### Launch Camera Preview\n\nRun:",
        },
      },
      {
        block_type: "code",
        sort_order: 22,
        content: {
          language: "bash",
          code: "rpicam-hello -t 10000",
        },
      },
      {
        block_type: "text",
        sort_order: 23,
        content: {
          markdown:
            "This command opens a live camera preview for 10 seconds.\n\n**What To Look For:**\n\n✓ Live image appears\n\n✓ Camera responds correctly\n\n✓ No error messages appear\n\n✓ Preview closes automatically\n\n### Engineering Insight\n\nYou have now verified the complete image acquisition pipeline:\n\n**Camera → Raspberry Pi → Operating System → Display Output**\n\nThis is the foundation of every Computer Vision project we will build.",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 24,
        content: {
          title: "Camera Verified",
          description:
            "Upload your camera detection screenshot (rpicam-hello --list-cameras) and camera preview screenshot (rpicam-hello -t 10000).",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "/summer-camp/ai-edge/photos/module-8/camera-list-cameras.png",
          referenceLabel: "Camp demo — rpicam-hello --list-cameras",
        },
      },
      kc("Section 7 — Knowledge Check", [
        {
          id: "q1",
          prompt: "What stores Raspberry Pi OS?",
          options: ["CPU", "RAM", "MicroSD Card", "HDMI Cable"],
          correctIndex: 2,
        },
        {
          id: "q2",
          prompt: "True or False: A Raspberry Pi requires an operating system before applications can run.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Which operating system should we select for this camp?",
          options: [
            "Raspberry Pi OS Legacy",
            "Ubuntu",
            "Raspberry Pi OS (64-bit)",
            "Windows",
          ],
          correctIndex: 2,
        },
        {
          id: "q4",
          prompt: "Which command checks connected cameras?",
          options: [
            "rpicam-hello --list-cameras",
            "ls /dev/camera",
            "python3 --version",
            "ifconfig",
          ],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "True or False: The camera is required for our Computer Vision and Object Detection activities.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 25),
      {
        block_type: "text",
        sort_order: 26,
        content: {
          markdown: "## Reflection & Feedback",
        },
      },
      reflect("What part of the setup process was most challenging?", 27),
      {
        block_type: "reflection",
        sort_order: 28,
        content: {
          prompt: "Did your Raspberry Pi boot successfully?",
          options: ["Yes", "No"],
        },
      },
      {
        block_type: "reflection",
        sort_order: 29,
        content: {
          prompt: "Did your camera pass verification?",
          options: ["Yes", "No"],
        },
      },
      {
        block_type: "text",
        sort_order: 30,
        content: {
          markdown:
            "### Need Help?\n\n- **Ask Instructor** — post in [Discussions & Help](/student/dashboard-v2/summer-camp/discussions)\n- **Ask AI Assistant** — visit [Support](/student/dashboard-v2/summer-camp/support)\n- **Upload Screenshot** — attach images in your discussion thread when stuck\n- **Open Discussion Thread** — search existing threads or start a new question",
        },
      },
      {
        block_type: "text",
        sort_order: 31,
        content: {
          markdown: "## Mission Success",
        },
      },
      {
        block_type: "interactive",
        sort_order: 32,
        content: { variant: "mission_success" },
      },
      {
        block_type: "module_completion",
        sort_order: 33,
        content: {
          title: "🎉 Congratulations Engineer!",
          message: "You have successfully prepared your Edge Computing platform.",
          rewards: {
            xp: 250,
            badges: ["edge-device-builder", "hardware-setup-cert"],
            nextModule: "Module 9 — OpenCV Setup & Computer Vision Environment",
            comingNext:
              "Install the software libraries that allow your Raspberry Pi to process images, detect faces, and begin performing real Computer Vision tasks.",
          },
        },
      },
    ],
  },
  {
    title: "Module 9 — OpenCV Setup & Computer Vision Environment",
    description:
      "Update Raspberry Pi, install dependencies, create a virtual environment, install OpenCV, launch Geany, and verify camera support.",
    sort_order: 9,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP Reward: 250 XP · Badge: Computer Vision Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand the role of OpenCV\n- Create an isolated Python project environment\n- Install required Computer Vision libraries\n- Verify OpenCV installation\n- Access the Raspberry Pi camera\n- Launch a Python development environment\n- Prepare for Face Detection and Object Detection projects",
        },
      },
      {
        block_type: "interactive",
        sort_order: 2,
        content: { variant: "opencv_mission" },
      },
      {
        block_type: "text",
        sort_order: 3,
        content: {
          markdown:
            "## Section 1 — Why Do We Need OpenCV?\n\nBefore AI can recognize objects, it must first see them.\n\n**OpenCV** (Open Source Computer Vision Library) provides the tools required to:\n\n- Capture images\n- Access cameras\n- Process video streams\n- Detect faces\n- Detect objects\n- Prepare images for AI systems",
        },
      },
      {
        block_type: "text",
        sort_order: 4,
        content: {
          markdown:
            "### Real World Applications\n\nExamples:\n\n- Self-driving vehicles\n- Smart surveillance systems\n- Robotics\n- Medical imaging\n- Smart agriculture",
        },
      },
      {
        block_type: "image_gallery",
        sort_order: 5,
        content: {
          cards: [
            {
              title: "Autonomous Vehicle",
              description: "Self-driving perception",
              imageUrl: "/summer-camp/module-0/autonomous-vehicle.png",
            },
            {
              title: "Smart Traffic Camera",
              description: "Smart surveillance",
              imageUrl: "/summer-camp/module-0/smart-traffic-camera.png",
            },
            {
              title: "Warehouse Robot",
              description: "Robotics vision",
              imageUrl: "/summer-camp/module-0/warehouse-robot.png",
            },
            {
              title: "Agricultural Drone",
              description: "Smart agriculture",
              imageUrl: "/summer-camp/module-0/agricultural-drone.png",
            },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 6,
        content: { variant: "opencv_pixels_poll" },
      },
      {
        block_type: "text",
        sort_order: 7,
        content: {
          markdown:
            "## Section 2 — Update Raspberry Pi & Install Dependencies\n\nBefore installing software we must update the system.",
        },
      },
      {
        block_type: "code",
        sort_order: 8,
        content: {
          language: "bash",
          code: "sudo apt update",
        },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown:
            "**What To Look For:** The terminal should display package lists being downloaded and updated.\n\n**Why This Matters:** Keeping the system updated improves compatibility and security.",
        },
      },
      {
        block_type: "text",
        sort_order: 10,
        content: {
          markdown: "### Install Supporting Libraries",
        },
      },
      {
        block_type: "code",
        sort_order: 11,
        content: {
          language: "bash",
          code: "sudo apt install -y libopenblas-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good",
        },
      },
      {
        block_type: "text",
        sort_order: 12,
        content: {
          markdown:
            "**What These Libraries Do:**\n\n- **OpenBLAS** → Accelerates mathematical operations\n- **GStreamer** → Supports video and camera processing\n\nThese tools help OpenCV work efficiently with camera streams.",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 13,
        content: {
          title: "Dependencies Installed",
          description: "Upload a screenshot showing successful dependency installation.",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "",
          referenceLabel: "Camp demo",
          studentLabel: "Your upload",
          referencePlaceholder: "Reference: apt install dependencies output",
        },
      },
      {
        block_type: "text",
        sort_order: 14,
        content: {
          markdown:
            "## Section 3 — Create Your Project Workspace\n\nEngineers organize their projects into dedicated folders.\n\nCreate your project directory:",
        },
      },
      {
        block_type: "code",
        sort_order: 15,
        content: {
          language: "bash",
          code: "mkdir ~/creditcenter",
        },
      },
      {
        block_type: "text",
        sort_order: 16,
        content: {
          markdown:
            "**Why This Matters:** This folder will contain Python code, images, Computer Vision projects, and Face Detection applications.\n\n**Student Activity:** Open Terminal and create the folder. Verify it exists using:",
        },
      },
      {
        block_type: "code",
        sort_order: 17,
        content: {
          language: "bash",
          code: "ls",
        },
      },
      {
        block_type: "text",
        sort_order: 18,
        content: {
          markdown:
            "## Section 4 — Create a Python Virtual Environment\n\nProfessional developers isolate project dependencies.\n\nNavigate into the project folder:",
        },
      },
      {
        block_type: "code",
        sort_order: 19,
        content: {
          language: "bash",
          code: "cd ~/creditcenter",
        },
      },
      {
        block_type: "text",
        sort_order: 20,
        content: {
          markdown: "Create virtual environment:",
        },
      },
      {
        block_type: "code",
        sort_order: 21,
        content: {
          language: "bash",
          code: "python3 -m venv pvamu",
        },
      },
      {
        block_type: "text",
        sort_order: 22,
        content: {
          markdown:
            "**Why This Matters:** Virtual environments prevent software conflicts between projects. Think of it as giving each project its own toolbox.\n\nActivate environment:",
        },
      },
      {
        block_type: "code",
        sort_order: 23,
        content: {
          language: "bash",
          code: "source ~/creditcenter/pvamu/bin/activate",
        },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown:
            "**Success Indicator:** You should see `(pvamu)` appear at the beginning of your terminal prompt.",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 25,
        content: {
          title: "Virtual Environment Activated",
          description: "Upload a screenshot showing the activated virtual environment (pvamu in your prompt).",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "",
          referenceLabel: "Camp demo",
          studentLabel: "Your upload",
          referencePlaceholder: "Reference: (pvamu) prompt after activate",
        },
      },
      {
        block_type: "text",
        sort_order: 26,
        content: {
          markdown: "## Section 5 — Install OpenCV\n\nUpgrade Python package tools:",
        },
      },
      {
        block_type: "code",
        sort_order: 27,
        content: {
          language: "bash",
          code: "pip install --upgrade pip setuptools wheel",
        },
      },
      {
        block_type: "text",
        sort_order: 28,
        content: {
          markdown: "**Why This Matters:** These tools manage software installation and updates.\n\nInstall OpenCV:",
        },
      },
      {
        block_type: "code",
        sort_order: 29,
        content: {
          language: "bash",
          code: "pip install opencv-python",
        },
      },
      {
        block_type: "text",
        sort_order: 30,
        content: {
          markdown:
            "**What To Look For:** Successful installation message — for example: `Successfully installed opencv-python`",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 31,
        content: {
          title: "OpenCV Installed",
          description: "Upload a screenshot showing successful OpenCV installation.",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "",
          referenceLabel: "Camp demo",
          studentLabel: "Your upload",
          referencePlaceholder: "Reference: pip install opencv-python success",
        },
      },
      {
        block_type: "text",
        sort_order: 32,
        content: {
          markdown: "## Section 6 — Verify OpenCV Installation\n\nRun Python:",
        },
      },
      {
        block_type: "code",
        sort_order: 33,
        content: {
          language: "bash",
          code: "python",
        },
      },
      {
        block_type: "text",
        sort_order: 34,
        content: {
          markdown: "Inside Python enter:",
        },
      },
      {
        block_type: "code",
        sort_order: 35,
        content: {
          language: "python",
          code: "import cv2\nprint(cv2.__version__)",
        },
      },
      {
        block_type: "text",
        sort_order: 36,
        content: {
          markdown:
            "**Expected Result:** OpenCV version number appears (for example `4.x.x`).\n\n**Success Criteria:**\n\n✓ No import errors\n\n✓ OpenCV version displayed",
        },
      },
      {
        block_type: "text",
        sort_order: 37,
        content: {
          markdown:
            "## Section 7 — Launch Geany Programming Editor\n\nNow we need a place to write code.\n\nOpen: **Raspberry Pi Menu → Programming → Geany Programmer's Editor**\n\n**What Is Geany?** A lightweight programming environment commonly used on Raspberry Pi. Students will use Geany to write and execute Python programs.\n\n**Student Activity:** Open Geany and create a new Python file. Save it as `camera_test.py`.",
        },
      },
      {
        block_type: "text",
        sort_order: 38,
        content: {
          markdown:
            "## Section 8 — Camera Verification with OpenCV\n\nWe previously verified the camera hardware. Now we prepare to use the camera through software.\n\n### Review Camera Commands\n\nList cameras:",
        },
      },
      {
        block_type: "code",
        sort_order: 39,
        content: {
          language: "bash",
          code: "rpicam-hello --list-cameras",
        },
      },
      {
        block_type: "text",
        sort_order: 40,
        content: {
          markdown:
            "**What To Look For:** Your camera should appear in the detected devices list.\n\nLaunch preview:",
        },
      },
      {
        block_type: "code",
        sort_order: 41,
        content: {
          language: "bash",
          code: "rpicam-hello -t 10000",
        },
      },
      {
        block_type: "text",
        sort_order: 42,
        content: {
          markdown:
            "**Expected Result:** A live camera preview appears for approximately 10 seconds.\n\n**Why This Matters:** If the camera works here, it will work inside our OpenCV applications.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 43,
        content: { variant: "camera_verify" },
      },
      {
        block_type: "checkpoint",
        sort_order: 44,
        content: {
          title: "Camera Verified with OpenCV Environment",
          description:
            "Upload your camera detection screenshot (rpicam-hello --list-cameras) and camera preview screenshot (rpicam-hello -t 10000).",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 8,
          referenceImageUrl: "",
          referenceLabel: "Camp demo",
          studentLabel: "Your upload",
          referencePlaceholder: "Reference: camera list + preview screenshots",
        },
      },
      {
        block_type: "interactive",
        sort_order: 45,
        content: { variant: "cv_environment_status" },
      },
      kc("Knowledge Check", [
        {
          id: "q1",
          prompt: "What is OpenCV primarily used for?",
          options: ["Computer Vision", "Web Browsing", "Databases", "Networking"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Virtual environments help isolate project dependencies.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "Which command activates the virtual environment?",
          options: [
            "source ~/creditcenter/pvamu/bin/activate",
            "python3 -m venv pvamu",
            "pip install opencv-python",
            "sudo apt update",
          ],
          correctIndex: 0,
        },
        {
          id: "q4",
          prompt: "Which library provides Computer Vision functionality?",
          options: ["OpenCV", "Chrome", "HDMI", "WiFi"],
          correctIndex: 0,
        },
        {
          id: "q5",
          prompt: "True or False: The Raspberry Pi camera should be verified before running Computer Vision applications.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
      ], 46),
      {
        block_type: "text",
        sort_order: 47,
        content: {
          markdown: "## Reflection & Feedback",
        },
      },
      {
        block_type: "reflection",
        sort_order: 48,
        content: {
          prompt: "Did OpenCV install successfully?",
          options: ["Yes", "No"],
        },
      },
      {
        block_type: "reflection",
        sort_order: 49,
        content: {
          prompt: "Were you able to activate the virtual environment?",
          options: ["Yes", "No"],
        },
      },
      reflect("What was the most interesting thing you learned today?", 50),
      {
        block_type: "text",
        sort_order: 51,
        content: {
          markdown:
            "### Need Help?\n\n- **Ask Instructor** — post in [Discussions & Help](/student/dashboard-v2/summer-camp/discussions)\n- **Ask AI Assistant** — visit [Support](/student/dashboard-v2/summer-camp/support)\n- **Upload Screenshot** — attach images in your discussion thread when stuck\n- **Open Discussion Thread** — search existing threads or start a new question",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 52,
        content: {
          title: "🎉 Congratulations Engineer!",
          message: "You successfully built your Computer Vision Environment.",
          rewards: {
            xp: 250,
            badges: ["opencv-explorer"],
            nextModule: "Module 10 — Running Your First Face & Eye Detection System",
            comingNext:
              "Running Your First Face & Eye Detection System — use your OpenCV environment for real-time face and eye detection on the Raspberry Pi.",
          },
        },
      },
    ],
  },
  {
    title: "Module 10 — Running Your First Face & Eye Detection System",
    description:
      "Face and eye detection with OpenCV, Haar cascades, virtual environment workflow, Geany IDE, live deployment, and first Edge Vision checkpoint.",
    sort_order: 10,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "Estimated time: 60–90 minutes · Difficulty: Beginner–Intermediate · XP Reward: 350 XP · Badge: Edge Vision Explorer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Understand Face Detection\n- Understand Eye Detection\n- Understand Bounding Boxes\n- Run a Real-Time Computer Vision Application\n- Observe Live Camera Processing\n- Analyze Detection Performance\n- Complete Your First Edge AI Deployment",
        },
      },
      {
        block_type: "interactive",
        sort_order: 2,
        content: { variant: "face_eye_mission" },
      },
      {
        block_type: "text",
        sort_order: 3,
        content: {
          markdown:
            "## Section 1 — Understanding Face & Eye Detection\n\nFace Detection is one of the most widely used Computer Vision technologies.\n\nIts goal is simple: **find human faces inside an image or video stream.**",
        },
      },
      {
        block_type: "interactive",
        sort_order: 4,
        content: { variant: "face_detection_workflow" },
      },
      {
        block_type: "interactive",
        sort_order: 5,
        content: { variant: "eye_detection_workflow" },
      },
      {
        block_type: "text",
        sort_order: 6,
        content: {
          markdown:
            "### Real-World Applications\n\nExamples:\n\n- Face Unlock\n- Smart Security Cameras\n- Video Conferencing\n- Driver Monitoring Systems\n- Human-Robot Interaction",
        },
      },
      {
        block_type: "image_gallery",
        sort_order: 7,
        content: {
          cards: [
            {
              title: "Smart Security Camera",
              description: "Face unlock & monitoring",
              imageUrl: "/summer-camp/module-0/smart-traffic-camera.png",
            },
            {
              title: "Smart Home Security",
              description: "Real-time alerts",
              imageUrl: "/summer-camp/module-0/smart-home-security.png",
            },
            {
              title: "Autonomous Vehicle",
              description: "Driver monitoring",
              imageUrl: "/summer-camp/module-0/autonomous-vehicle.png",
            },
            {
              title: "Warehouse Robot",
              description: "Human-robot interaction",
              imageUrl: "/summer-camp/module-0/warehouse-robot.png",
            },
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 8,
        content: { variant: "face_eye_engineer_poll" },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown:
            "## Section 2 — Understanding Detection Results\n\nOur application performs two tasks simultaneously:\n\n✓ Face Detection\n\n✓ Eye Detection",
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "face_eye_pipeline" },
      },
      {
        block_type: "interactive",
        sort_order: 11,
        content: { variant: "face_eye_bounding_legend" },
      },
      {
        block_type: "text",
        sort_order: 12,
        content: {
          markdown:
            "## Section 3 — Face & Eye Detection Summer Camp Demo\n\nThe camp includes a complete Face & Eye Detection application built using:\n\n- OpenCV\n- Haar Cascade Classifiers\n- Raspberry Pi Camera\n- Python\n\n## Code Lab: Face & Eye Detection Demo\n\nReview the instructor-provided code below. You do **not** need to understand every line — focus on: open camera → capture frames → detect faces → detect eyes → draw bounding boxes → display results.",
        },
      },
      {
        block_type: "code",
        sort_order: 13,
        content: {
          contentType: "code_lab",
          language: "python",
          title: "Face & Eye Detection Summer Camp Demo",
          description:
            "This program uses OpenCV Haar Cascades to detect faces and eyes in real time using the Raspberry Pi camera.",
          filename: "face_eye_detection.py",
          downloadFilename: "face_eye_detection.py",
          allowCopy: true,
          allowDownload: true,
          studentCopyEnabled: true,
          studentDownloadEnabled: true,
          allowExpand: true,
          allowFullscreen: true,
          allowLineNumbers: true,
          showFilename: true,
          showDescription: true,
          showRunInstructions: true,
          runInstructions:
            "source ~/creditcenter/pvamu/bin/activate\ncd ~/creditcenter\npython face_eye_detection.py",
          code: FACE_EYE_DETECTION_DEMO,
        },
      },
      {
        block_type: "text",
        sort_order: 14,
        content: {
          markdown:
            "### Student Instructions\n\n1. Review the code\n2. Download or copy the code\n3. Save the file as `face_eye_detection.py`\n4. Follow the run instructions in Section 4",
        },
      },
      {
        block_type: "text",
        sort_order: 15,
        content: {
          markdown: "## Section 4 — Running The Demo\n\n### Step 1 — Activate Virtual Environment\n\nOpen Terminal and run:",
        },
      },
      {
        block_type: "code",
        sort_order: 16,
        content: {
          language: "bash",
          title: "Activate Environment",
          allowCopy: true,
          code: "source ~/creditcenter/pvamu/bin/activate",
        },
      },
      {
        block_type: "text",
        sort_order: 17,
        content: {
          markdown:
            "A successful activation shows `(pvamu)` at the beginning of your terminal prompt.\n\n### Step 2 — Open Geany\n\n**Raspberry Pi Menu → Programming → Geany Programmer's Editor**\n\n### Step 3 — Create Program File\n\nCreate and save: `face_eye_detection.py` inside `~/creditcenter`\n\n### Step 4 — Paste Demo Code\n\nCopy the code from the Code Lab and paste it into Geany.\n\n### Step 5 — Save Program\n\nSave the file inside `~/creditcenter`.\n\n### Step 6 — Run The Program\n\n**Option A — Run From Geany:** Build → Execute\n\n**Option B — Run From Terminal:**",
        },
      },
      {
        block_type: "code",
        sort_order: 18,
        content: {
          language: "bash",
          title: "Run Face Detection Program",
          allowCopy: true,
          code: "source ~/creditcenter/pvamu/bin/activate\npython face_eye_detection.py",
        },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: { variant: "face_eye_run_success" },
      },
      {
        block_type: "text",
        sort_order: 20,
        content: {
          markdown:
            "## Section 5 — Sample Detection Results\n\nCompare your live detection output to the **Summer Camp demo results** below, then upload your own screenshots.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 21,
        content: {
          variant: "face_eye_sample_gallery",
          samples: [
            {
              title: "Face & Eye Detection Result",
              caption: "Green boxes indicate faces; blue rectangles indicate detected eyes.",
              imageUrl: "/summer-camp/ai-edge/photos/face-eye-detection-sample.png",
            },
          ],
        },
      },
      {
        block_type: "text",
        sort_order: 22,
        content: {
          markdown:
            "### Required Submission\n\nUpload:\n\n✓ Face Detection Screenshot\n\n✓ Eye Detection Screenshot\n\nOptional:\n\n✓ Video Demonstration",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 23,
        content: {
          title: "Face & Eye Detection Results",
          description:
            "Upload face detection and eye detection screenshots. Optional: include a short video demonstration (up to 5 files).",
          acceptedTypes: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"],
          maxSizeMb: 50,
        },
      },
      {
        block_type: "text",
        sort_order: 24,
        content: {
          markdown: "## Section 6 — Face Detection Investigation\n\nNow think like an engineer.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 25,
        content: { variant: "face_eye_investigation" },
      },
      {
        block_type: "text",
        sort_order: 26,
        content: {
          markdown: "## Section 7 — Troubleshooting",
        },
      },
      {
        block_type: "interactive",
        sort_order: 27,
        content: { variant: "face_eye_troubleshooting" },
      },
      {
        block_type: "code",
        sort_order: 28,
        content: {
          language: "python",
          title: "Verify OpenCV Installation",
          allowCopy: true,
          code: "import cv2\n\nprint(cv2.__version__)",
        },
      },
      {
        block_type: "text",
        sort_order: 29,
        content: {
          markdown:
            "### Need Help?\n\n- **Ask Instructor** — post in [Discussions & Help](/student/dashboard-v2/summer-camp/discussions)\n- **Ask AI Assistant** — visit [Support](/student/dashboard-v2/summer-camp/support)\n- **Upload Error Screenshot** — attach images in your discussion thread\n- **Open Discussion Thread** — search existing threads or start a new question",
        },
      },
      {
        block_type: "text",
        sort_order: 30,
        content: {
          markdown:
            "## Section 8 — Deployment Checkpoint\n\n### First Edge Vision Deployment\n\nSuccessfully demonstrate:\n\n✓ Face Detection\n\n✓ Eye Detection\n\n✓ Live Camera Feed\n\n**Faculty review required.**",
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 31,
        content: {
          title: "First Face Detection Deployment",
          description:
            "Upload a screenshot or short video demonstrating face detection, eye detection, and live camera feed. Faculty review required.",
          acceptedTypes: ["video/mp4", "video/webm", "image/png", "image/jpeg", "image/webp"],
          maxSizeMb: 50,
          facultyApproval: true,
        },
      },
      kc("Section 9 — Knowledge Check", [
        {
          id: "q1",
          prompt: "What is the primary purpose of Face Detection?",
          options: ["Find human faces in images", "Increase internet speed", "Store files", "Connect WiFi"],
          correctIndex: 0,
        },
        {
          id: "q2",
          prompt: "True or False: Eye detection occurs after a face is detected.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q3",
          prompt: "What do bounding boxes indicate?",
          options: ["Object location", "Battery level", "Memory usage", "Camera quality"],
          correctIndex: 0,
        },
        {
          id: "q4",
          prompt: "True or False: Lighting conditions can affect detection accuracy.",
          options: ["True", "False"],
          correctIndex: 0,
          trueFalse: true,
        },
        {
          id: "q5",
          prompt: "Which library powers our detection system?",
          options: ["OpenCV", "Microsoft Word", "Chrome", "HDMI"],
          correctIndex: 0,
        },
      ], 32),
      {
        block_type: "text",
        sort_order: 33,
        content: {
          markdown: "## Reflection & Feedback",
        },
      },
      reflect("How many faces did your system detect?", 34),
      reflect("What surprised you most?", 35),
      {
        block_type: "reflection",
        sort_order: 36,
        content: {
          prompt: "Did your Face & Eye Detection system run successfully?",
          options: ["Yes", "No"],
        },
      },
      {
        block_type: "text",
        sort_order: 37,
        content: {
          markdown:
            "### Need Help?\n\n- **Ask Instructor** — post in [Discussions & Help](/student/dashboard-v2/summer-camp/discussions)\n- **Ask AI Assistant** — visit [Support](/student/dashboard-v2/summer-camp/support)\n- **Upload Screenshot** — attach images when stuck\n- **Open Discussion Thread** — search or start a new question",
        },
      },
      {
        block_type: "interactive",
        sort_order: 38,
        content: { variant: "face_eye_mission_accomplished" },
      },
      {
        block_type: "module_completion",
        sort_order: 39,
        content: {
          title: "🎉 Congratulations Engineer!",
          message: "You successfully built your Computer Vision Environment and deployed face & eye detection.",
          rewards: {
            xp: 350,
            badges: ["edge-vision-explorer", "first-cv-deployment-cert"],
            nextModule: "Module 11 — Final Project Showcase",
            comingNext:
              "Final Projects unlocked — Smart Object Detection Camera, Smart Campus Safety Assistant, and Smart Recycling Assistant. You are now ready to build complete Edge AI systems.",
          },
        },
      },
    ],
  },
  {
    title: "Module 11 — Final Project Showcase",
    description:
      "Showcase your Edge AI Computer Vision system — face & eye detection demo, optional capstone project, video evidence, reflection report, rubric, and camp certificate.",
    sort_order: 11,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "tip",
          text: "AI & Edge Computing Summer Camp 2026 · Estimated time: 2–4 hours · XP Reward: 500 XP · Final Badge: Edge AI Engineer",
        },
      },
      {
        block_type: "text",
        sort_order: 1,
        content: {
          markdown:
            "### Learning Objectives\n\nBy the end of this module you will:\n\n- Showcase your complete Edge AI learning journey\n- Demonstrate face & eye detection on Raspberry Pi\n- Submit video and screenshot evidence\n- Write an engineering reflection report\n- Complete the final survey and earn your camp certificate",
        },
      },
      {
        block_type: "text",
        sort_order: 2,
        content: {
          markdown:
            "## Final Project Showcase\n\nCongratulations! You have completed the full learning journey — from AI fundamentals through OpenCV and live face & eye detection. You are ready to showcase your **Edge AI Computer Vision System**.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "showcase_journey" },
      },
      {
        block_type: "interactive",
        sort_order: 4,
        content: { variant: "showcase_objectives" },
      },
      {
        block_type: "text",
        sort_order: 5,
        content: {
          markdown:
            "### Optional Capstone Extensions\n\nModule 10 unlocked three capstone projects you can extend your showcase with:\n\n- **Smart Object Detection Camera** — TensorFlow Lite object detection\n- **Smart Campus Safety Assistant** — Edge AI safety monitoring\n- **Smart Recycling Assistant** — Vision-based recycling guidance\n\nYour showcase **must** include the Module 10 face & eye detection demo. Capstone work is optional but earns bonus rubric points.",
        },
      },
      {
        block_type: "text",
        sort_order: 6,
        content: {
          markdown: "## Deliverable 1 — Video Demonstration (Required)\n\nRecord a **3–5 minute MP4** video demonstrating your project.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 7,
        content: { variant: "video_demo_guide" },
      },
      {
        block_type: "checkpoint",
        sort_order: 8,
        content: {
          title: "Video Demonstration",
          description:
            "Upload your 3–5 minute MP4 video: introduction, hardware overview, live face & eye detection (required), pipeline explanation, and reflection. Optional: include capstone project demo. Faculty review required.",
          acceptedTypes: ["video/mp4"],
          maxSizeMb: 50,
          facultyApproval: true,
        },
      },
      {
        block_type: "text",
        sort_order: 9,
        content: {
          markdown: "## Deliverable 2 — Screenshot Evidence\n\nSubmit PNG or JPG screenshots.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 10,
        content: { variant: "screenshot_guide" },
      },
      {
        block_type: "checkpoint",
        sort_order: 11,
        content: {
          title: "Screenshot 1 — Raspberry Pi Desktop",
          description: "Upload a screenshot of your Raspberry Pi desktop environment.",
          acceptedTypes: ["image/png", "image/jpeg"],
          maxSizeMb: 8,
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 12,
        content: {
          title: "Screenshot 2 — Camera Verification",
          description: "Upload a screenshot showing camera verification (e.g. rpicam-hello output).",
          acceptedTypes: ["image/png", "image/jpeg"],
          maxSizeMb: 8,
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 13,
        content: {
          title: "Screenshot 3 — Face & Eye Detection Running",
          description:
            "Upload a screenshot showing face detection (green box) and eye detection (blue boxes) with bounding boxes visible.",
          acceptedTypes: ["image/png", "image/jpeg"],
          maxSizeMb: 8,
          facultyApproval: true,
        },
      },
      {
        block_type: "checkpoint",
        sort_order: 14,
        content: {
          title: "Screenshot 4 — Multiple Faces or Capstone Demo (Bonus)",
          description:
            "Optional bonus: upload a screenshot detecting multiple faces, or a capstone project detection demo.",
          acceptedTypes: ["image/png", "image/jpeg"],
          maxSizeMb: 8,
        },
      },
      {
        block_type: "text",
        sort_order: 15,
        content: {
          markdown: "## Deliverable 3 — Engineering Reflection Report\n\nWrite a **1–2 page** reflection report covering all five sections below.",
        },
      },
      {
        block_type: "interactive",
        sort_order: 16,
        content: { variant: "reflection_report_guide" },
      },
      {
        block_type: "checkpoint",
        sort_order: 17,
        content: {
          title: "Engineering Reflection Report",
          description: "Upload your completed 1–2 page reflection report (PDF preferred, or DOC/image). Faculty review required.",
          acceptedTypes: ["application/pdf", "image/png", "image/jpeg"],
          maxSizeMb: 15,
          facultyApproval: true,
        },
      },
      {
        block_type: "interactive",
        sort_order: 18,
        content: { variant: "showcase_rubric" },
      },
      {
        block_type: "interactive",
        sort_order: 19,
        content: {
          variant: "achievement_summary",
          title: "Camp Achievement Summary",
          subtitle: "Everything you accomplished in AI & Edge Computing Summer Camp 2026.",
          items: [
            "Completed Modules 0–11",
            "Passed Module Knowledge Checks",
            "Completed Engineering Checkpoints",
            "Built Raspberry Pi Edge AI System",
            "Deployed Face & Eye Detection",
            "Submitted Final Showcase",
          ],
        },
      },
      {
        block_type: "interactive",
        sort_order: 20,
        content: { variant: "certificate_requirements" },
      },
      {
        block_type: "interactive",
        sort_order: 21,
        content: { variant: "certificate_award" },
      },
      {
        block_type: "interactive",
        sort_order: 22,
        content: { variant: "final_survey" },
      },
      {
        block_type: "interactive",
        sort_order: 23,
        content: {
          variant: "graduation",
          headline: "You are now an Edge AI Engineer",
          skills: [
            "Artificial Intelligence",
            "Computer Vision",
            "Edge Computing",
            "Raspberry Pi",
            "OpenCV",
            "Face & Eye Detection",
          ],
          skillsLeadIn: "You built a real Edge AI system using:",
        },
      },
      {
        block_type: "module_completion",
        sort_order: 24,
        content: {
          title: "🎉 Congratulations!",
          message: "You are now an Edge AI Engineer and have completed the AI & Edge Computing Summer Camp 2026.",
          rewards: {
            xp: 500,
            badges: ["edge-ai-engineer", "camp-certificate-2026"],
            comingNext:
              "Keep building. Keep exploring. Keep innovating. Explore capstone projects or build your own Edge AI systems — the future of AI is in your hands.",
          },
        },
      },
    ],
  },
]
