/** Module 1 final knowledge check — 22 questions covering all major sections. */

export const AI_BOOTCAMP_MODULE_1_QUIZ: Array<Record<string, unknown>> = [
  {
    id: "q1",
    prompt:
      "In simple terms, Artificial Intelligence is best described as technology that enables computers to…",
    options: [
      "Store files in the cloud faster than humans",
      "Perform tasks that normally require human intelligence, such as understanding language or recognizing patterns",
      "Replace the internet with a single supercomputer",
      "Run only when a programmer writes every possible rule in advance",
    ],
    correctIndex: 1,
  },
  {
    id: "q2",
    prompt:
      "Which everyday example most clearly shows AI learning from data rather than following fixed rules?",
    options: [
      "A calculator adding 15 + 27",
      "A traffic light on a fixed timer",
      "Netflix recommending shows based on your watch history",
      "A digital clock displaying the current time",
    ],
    correctIndex: 2,
  },
  {
    id: "q3",
    prompt: "Machine Learning is best defined as…",
    options: [
      "A branch of AI where systems improve by finding patterns in examples or data",
      "Hardware that makes computers run faster",
      "A social media app for sharing photos",
      "A type of virus that attacks computers",
    ],
    correctIndex: 0,
  },
  {
    id: "q4",
    prompt: "Generative AI differs from many traditional AI systems because it…",
    options: [
      "Only classifies images into categories",
      "Creates new content such as text, images, music, or code",
      "Never uses data during training",
      "Can only run on supercomputers in laboratories",
    ],
    correctIndex: 1,
  },
  {
    id: "q5",
    prompt: "Which type of AI actually exists and is widely used today?",
    options: [
      "Artificial General Intelligence that can do every human job perfectly",
      "Artificial Super Intelligence that exceeds all human ability",
      "Narrow AI designed for specific tasks like translation or recommendations",
      "Theory of Mind AI that fully understands human emotions",
    ],
    correctIndex: 2,
  },
  {
    id: "q6",
    prompt: "Alan Turing's famous 1950 question — \"Can machines think?\" — helped launch the field by asking us to consider…",
    options: [
      "Whether computers could be programmed with moral values only",
      "Whether machines could demonstrate intelligent behavior",
      "Whether smartphones would exist by 1990",
      "Whether robots would automatically have legal rights",
    ],
    correctIndex: 1,
  },
  {
    id: "q7",
    prompt: "In 2022, ChatGPT helped bring Generative AI into mainstream use because it showed that AI could…",
    options: [
      "Replace all teachers overnight",
      "Hold natural conversations and generate helpful text for millions of users",
      "Guarantee that every answer is factually correct",
      "Operate without any training data",
    ],
    correctIndex: 1,
  },
  {
    id: "q8",
    prompt: "Supervised learning, at a high level, means the computer learns from…",
    options: [
      "Random guesses with no examples",
      "Labeled examples where the correct answer is known (e.g., \"spam\" vs \"not spam\")",
      "Only video games with no feedback",
      "Human emotions detected through cameras",
    ],
    correctIndex: 1,
  },
  {
    id: "q9",
    prompt: "What is a token in the context of Large Language Models (LLMs)?",
    options: [
      "A physical chip inside your phone",
      "A small piece of text the model reads or writes — often part of a word",
      "A cryptocurrency used to pay for AI",
      "A password that unlocks ChatGPT",
    ],
    correctIndex: 1,
  },
  {
    id: "q10",
    prompt: "Why do LLMs sometimes \"hallucinate\"?",
    options: [
      "They deliberately lie to trick users",
      "They predict likely text based on patterns but do not truly verify facts against the real world",
      "They only work when the internet is disconnected",
      "They have human emotions that cause mistakes",
    ],
    correctIndex: 1,
  },
  {
    id: "q11",
    prompt: "Which healthcare example shows responsible AI use?",
    options: [
      "A doctor uses AI to suggest patterns in scans but makes the final diagnosis",
      "A patient accepts an AI cancer diagnosis without any human review",
      "A hospital publishes every patient record online to train models",
      "An AI system replaces all nurses because it is \"always correct\"",
    ],
    correctIndex: 0,
  },
  {
    id: "q12",
    prompt: "Which statement about AI limitations is TRUE?",
    options: [
      "AI can guarantee factual accuracy in every answer",
      "AI can automatically accept legal and ethical responsibility for its outputs",
      "AI may sound confident even when information is wrong or incomplete",
      "AI understands the world exactly the way humans do",
    ],
    correctIndex: 2,
  },
  {
    id: "q13",
    prompt: "The myth \"AI is always correct\" is false because…",
    options: [
      "AI never uses data",
      "AI outputs depend on training data, prompts, and limits — humans must verify important claims",
      "AI only works on old computers",
      "AI cannot process language",
    ],
    correctIndex: 1,
  },
  {
    id: "q14",
    prompt: "Responsible AI includes paying attention to…",
    options: [
      "Privacy, bias, transparency, and academic integrity",
      "Only making AI run as fast as possible",
      "Sharing passwords so models learn faster",
      "Using AI outputs without reading them",
    ],
    correctIndex: 0,
  },
  {
    id: "q15",
    prompt: "Deep Learning is best understood as…",
    options: [
      "A method within Machine Learning that uses layered neural networks to learn complex patterns",
      "A type of calculator for deep-sea exploration",
      "A social media trend unrelated to computers",
      "A replacement for all human teachers",
    ],
    correctIndex: 0,
  },
  {
    id: "q16",
    prompt: "Which activity best demonstrates the difference between traditional programming and AI?",
    options: [
      "Using a calculator for homework vs. a spam filter that improves after seeing thousands of emails",
      "Typing in Word vs. printing a document",
      "Charging a phone vs. turning on a lamp",
      "Saving a file vs. deleting a file",
    ],
    correctIndex: 0,
  },
  {
    id: "q17",
    prompt: "Reactive AI (like early chess programs that only react to the current board) is an example of…",
    options: [
      "Narrow AI with no memory of past experiences beyond the current moment",
      "Artificial General Intelligence",
      "Human consciousness in machines",
      "AI that can feel emotions",
    ],
    correctIndex: 0,
  },
  {
    id: "q18",
    prompt: "In agriculture, AI might help farmers by…",
    options: [
      "Analyzing drone images to detect crop disease early",
      "Eliminating the need for soil and water",
      "Guaranteeing perfect weather every season",
      "Replacing all human food safety rules",
    ],
    correctIndex: 0,
  },
  {
    id: "q19",
    prompt: "Why does prompting matter when using tools like ChatGPT or Claude?",
    options: [
      "Clear, specific prompts help the model understand your goal and produce more useful responses",
      "Prompts are only decorative and change nothing",
      "The model ignores all instructions in prompts",
      "Prompts are illegal in most countries",
    ],
    correctIndex: 0,
  },
  {
    id: "q20",
    prompt: "Which example is Generative AI rather than only classification?",
    options: [
      "An email filter labeling messages as spam",
      "A face-unlock system verifying your identity",
      "An image generator creating a new poster from a text description",
      "A GPS system calculating the shortest route",
    ],
    correctIndex: 2,
  },
  {
    id: "q21",
    prompt: "Human intelligence, as discussed in this module, includes the ability to…",
    options: [
      "Learn from experience, adapt, reason, and make decisions",
      "Only memorize facts without understanding",
      "Operate without any emotions or context ever",
      "Process data exactly like a simple calculator",
    ],
    correctIndex: 0,
  },
  {
    id: "q22",
    prompt: "After completing Module 1, you are prepared to…",
    options: [
      "Build a self-driving car entirely on your own without guidance",
      "Use AI tools more effectively in Module 2 with awareness of strengths and limits",
      "Trust every AI answer without verification",
      "Avoid AI completely in school and work",
    ],
    correctIndex: 1,
  },
]
