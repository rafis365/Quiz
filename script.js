// Initialize Firebase with your config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const adminPanel = document.getElementById('admin-panel');
const studentPanel = document.getElementById('student-panel');
const resultsPanel = document.getElementById('results-panel');
const loadingSpinner = document.getElementById('loading-spinner');
const questionsContainer = document.getElementById('questions-container');
const studentQuestionsContainer = document.getElementById('student-questions-container');
const examTitleInput = document.getElementById('exam-title');
const examDurationInput = document.getElementById('exam-duration');
const negativeMarkingInput = document.getElementById('negative-marking');
const addQuestionBtn = document.getElementById('add-question');
const saveExamBtn = document.getElementById('save-exam');
const printExamBtn = document.getElementById('print-exam');
const printExamWithAnswersBtn = document.getElementById('print-exam-with-answers');
const examLinkContainer = document.getElementById('exam-link-container');
const examLinkInput = document.getElementById('exam-link');
const copyLinkBtn = document.getElementById('copy-link');
const studentExamTitle = document.getElementById('student-exam-title');
const timerContainer = document.getElementById('timer-container');
const timerDisplay = document.getElementById('timer');
const submitExamBtn = document.getElementById('submit-exam');
const resultsDetails = document.getElementById('results-details');
const backToAdminBtn = document.getElementById('back-to-admin');
const examStatusBadge = document.getElementById('exam-status-badge');
const fabToggle = document.getElementById('fab-toggle');

// Variables
let examId = null;
let timerInterval = null;
let timeRemaining = 0;
let currentExamData = null;
let studentAnswers = {};
let currentView = 'admin'; // 'admin', 'student', or 'results'

// Check URL for exam ID
function checkUrlForExam() {
    const urlParams = new URLSearchParams(window.location.search);
    const examIdParam = urlParams.get('exam');
    
    if (examIdParam) {
        showLoading();
        loadExamForStudent(examIdParam);
    }
}

// Show loading spinner
function showLoading() {
    adminPanel.classList.add('hidden');
    studentPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
}

// Hide loading spinner
function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// Add new question
addQuestionBtn.addEventListener('click', () => {
    const questionCount = questionsContainer.children.length + 1;
    
    const questionHtml = `
        <div class="question-card" data-question-id="${questionCount}">
            <div class="question-number">${questionCount}</div>
            <button class="btn btn-danger btn-sm no-print remove-question" style="position: absolute; right: 15px; top: 15px;">
                <i class="fas fa-trash-alt me-1"></i>Remove
            </button>
            <div class="mb-3">
                <label class="form-label">Question Text</label>
                <textarea class="form-control question-text" rows="3" placeholder="Enter question text"></textarea>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <label class="form-label">Points</label>
                    <input type="number" class="form-control question-points" min="1" value="1">
                </div>
            </div>
            <div class="options-container mt-3">
                <h6 class="mb-2">Options:</h6>
                <div class="option-container">
                    <div class="form-check mb-2">
                        <input type="radio" class="form-check-input correct-answer" name="correct-answer-${questionCount}" value="1" checked>
                        <label class="form-check-label">Option 1</label>
                        <input type="text" class="form-control mt-1 option-text" placeholder="Enter option text">
                    </div>
                </div>
                <div class="option-container">
                    <div class="form-check mb-2">
                        <input type="radio" class="form-check-input correct-answer" name="correct-answer-${questionCount}" value="2">
                        <label class="form-check-label">Option 2</label>
                        <input type="text" class="form-control mt-1 option-text" placeholder="Enter option text">
                    </div>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm add-option mt-2">
                <i class="fas fa-plus me-1"></i>Add Option
            </button>
        </div>
    `;
    
    questionsContainer.insertAdjacentHTML('beforeend', questionHtml);
    
    // Add event listeners for the new question
    const newQuestion = questionsContainer.lastElementChild;
    newQuestion.querySelector('.remove-question').addEventListener('click', () => {
        newQuestion.remove();
        renumberQuestions();
    });
    
    newQuestion.querySelector('.add-option').addEventListener('click', () => {
        addOptionToQuestion(newQuestion);
    });
    
    // Update exam status badge
    examStatusBadge.classList.remove('bg-secondary');
    examStatusBadge.classList.add('bg-warning');
    examStatusBadge.textContent = 'Draft';
});

// Renumber questions after deletion
function renumberQuestions() {
    const questions = questionsContainer.querySelectorAll('.question-card');
    questions.forEach((question, index) => {
        const newId = index + 1;
        question.dataset.questionId = newId;
        question.querySelector('.question-number').textContent = newId;
        const radioButtons = question.querySelectorAll('.correct-answer');
        radioButtons.forEach(radio => {
            radio.name = `correct-answer-${newId}`;
        });
    });
}

// Add option to a question
function addOptionToQuestion(questionElement) {
    const questionId = questionElement.dataset.questionId;
    const optionsContainer = questionElement.querySelector('.options-container');
    const optionCount = optionsContainer.querySelectorAll('.option-container').length + 1;
    
    const optionHtml = `
        <div class="option-container">
            <div class="form-check mb-2">
                <input type="radio" class="form-check-input correct-answer" name="correct-answer-${questionId}" value="${optionCount}">
                <label class="form-check-label">Option ${optionCount}</label>
                <input type="text" class="form-control mt-1 option-text" placeholder="Enter option text">
            </div>
        </div>
    `;
    
    optionsContainer.insertAdjacentHTML('beforeend', optionHtml);
}

// Save exam to Firebase
saveExamBtn.addEventListener('click', () => {
    const examTitle = examTitleInput.value.trim();
    const duration = parseInt(examDurationInput.value);
    const negativeMarking = parseInt(negativeMarkingInput.value) / 100;
    
    if (!examTitle) {
        showAlert('Please enter an exam title', 'danger');
        examTitleInput.focus();
        return;
    }
    
    if (isNaN(duration) || duration <= 0) {
        showAlert('Please enter a valid duration', 'danger');
        examDurationInput.focus();
        return;
    }
    
    if (isNaN(negativeMarking) || negativeMarking < 0 || negativeMarking > 1) {
        showAlert('Please enter valid negative marking (0-100%)', 'danger');
        negativeMarkingInput.focus();
        return;
    }
    
    const questions = [];
    const questionElements = questionsContainer.querySelectorAll('.question-card');
    
    if (questionElements.length === 0) {
        showAlert('Please add at least one question', 'danger');
        return;
    }
    
    let hasError = false;
    
    questionElements.forEach(questionElement => {
        if (hasError) return;
        
        const questionId = questionElement.dataset.questionId;
        const questionText = questionElement.querySelector('.question-text').value.trim();
        const points = parseInt(questionElement.querySelector('.question-points').value);
        const options = [];
        
        let correctAnswer = null;
        
        const optionElements = questionElement.querySelectorAll('.option-container');
        optionElements.forEach((optionElement, index) => {
            const optionText = optionElement.querySelector('.option-text').value.trim();
            const isCorrect = optionElement.querySelector('.correct-answer').checked;
            
            if (isCorrect) {
                correctAnswer = index + 1;
            }
            
            options.push({
                id: index + 1,
                text: optionText
            });
        });
        
        if (!questionText) {
            showAlert(`Please enter text for question ${questionId}`, 'danger');
            questionElement.querySelector('.question-text').focus();
            hasError = true;
            return;
        }
        
        if (options.some(opt => !opt.text)) {
            showAlert(`Please fill all options for question ${questionId}`, 'danger');
            hasError = true;
            return;
        }
        
        if (correctAnswer === null) {
            showAlert(`Please select a correct answer for question ${questionId}`, 'danger');
            hasError = true;
            return;
        }
        
        if (isNaN(points) || points <= 0) {
            showAlert(`Please enter valid points for question ${questionId}`, 'danger');
            questionElement.querySelector('.question-points').focus();
            hasError = true;
            return;
        }
        
        questions.push({
            id: parseInt(questionId),
            text: questionText,
            points: points,
            options: options,
            correctAnswer: correctAnswer
        });
    });
    
    if (hasError) return;
    
    // Generate unique exam ID
    examId = generateId();
    
    const examData = {
        title: examTitle,
        duration: duration,
        negativeMarking: negativeMarking,
        questions: questions,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };
    
    showLoading();
    
    // Save to Firebase
    database.ref('exams/' + examId).set(examData)
        .then(() => {
            currentExamData = examData;
            hideLoading();
            
            // Generate shareable link
            const currentUrl = window.location.href.split('?')[0];
            const examLink = `${currentUrl}?exam=${examId}`;
            examLinkInput.value = examLink;
            examLinkContainer.classList.remove('hidden');
            
            // Update exam status badge
            examStatusBadge.classList.remove('bg-warning');
            examStatusBadge.classList.add('bg-success');
            examStatusBadge.textContent = 'Saved';
            
            showAlert('Exam saved successfully!', 'success');
            
            // Show FAB for view switching
            fabToggle.classList.remove('hidden');
        })
        .catch(error => {
            hideLoading();
            console.error('Error saving exam:', error);
            showAlert('Error saving exam. Please try again.', 'danger');
        });
});

// Show alert message
function showAlert(message, type) {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert-floating');
    if (existingAlert) existingAlert.remove();
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show alert-floating" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 1100; max-width: 400px;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert-floating');
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

// Copy exam link
copyLinkBtn.addEventListener('click', () => {
    examLinkInput.select();
    document.execCommand('copy');
    showAlert('Link copied to clipboard!', 'success');
});

// Generate random ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Load exam for student
function loadExamForStudent(examIdParam) {
    database.ref('exams/' + examIdParam).once('value')
        .then(snapshot => {
            const examData = snapshot.val();
            
            if (!examData) {
                hideLoading();
                showAlert('Exam not found', 'danger');
                return;
            }
            
            // Check if exam is expired
            const now = new Date();
            const expiresAt = new Date(examData.expiresAt);
            if (now > expiresAt) {
                hideLoading();
                showAlert('This exam has expired', 'danger');
                return;
            }
            
            currentExamData = examData;
            examId = examIdParam;
            studentExamTitle.textContent = examData.title;
            
            // Convert duration to seconds
            timeRemaining = examData.duration * 60;
            updateTimerDisplay();
            
            // Start timer
            timerInterval = setInterval(() => {
                timeRemaining--;
                updateTimerDisplay();
                
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    submitExam();
                }
            }, 1000);
            
            // Load questions
            studentQuestionsContainer.innerHTML = '';
            examData.questions.forEach(question => {
                const questionHtml = `
                    <div class="question-card" data-question-id="${question.id}">
                        <div class="question-number">${question.id}</div>
                        <div class="question-text mb-3">
                            <strong>${question.text}</strong>
                            <span class="badge bg-primary float-end">${question.points} point${question.points > 1 ? 's' : ''}</span>
                        </div>
                        <div class="options-container">
                            ${question.options.map(option => `
                                <div class="option-container">
                                    <div class="form-check">
                                        <input type="radio" class="form-check-input student-answer" name="question-${question.id}" value="${option.id}" id="q${question.id}-o${option.id}">
                                        <label class="form-check-label" for="q${question.id}-o${option.id}">${option.text}</label>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                
                studentQuestionsContainer.insertAdjacentHTML('beforeend', questionHtml);
            });
            
            // Switch to student view
            hideLoading();
            adminPanel.classList.add('hidden');
            resultsPanel.classList.add('hidden');
            studentPanel.classList.remove('hidden');
            currentView = 'student';
            
            // Show FAB for view switching
            fabToggle.classList.remove('hidden');
        })
        .catch(error => {
            hideLoading();
            console.error('Error loading exam:', error);
            showAlert('Error loading exam. Please try again.', 'danger');
        });
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update timer styling based on remaining time
    if (timeRemaining <= 300) { // 5 minutes or less
        timerContainer.classList.add('warning');
        timerContainer.classList.remove('danger');
    } else {
        timerContainer.classList.remove('warning');
        timerContainer.classList.remove('danger');
    }
    
    if (timeRemaining <= 60) { // 1 minute or less
        timerContainer.classList.remove('warning');
        timerContainer.classList.add('danger');
    }
}

// Submit exam
submitExamBtn.addEventListener('click', submitExam);

function submitExam() {
    clearInterval(timerInterval);
    
    // Collect student answers
    studentAnswers = {};
    const questionElements = studentQuestionsContainer.querySelectorAll('.question-card');
    
    questionElements.forEach(questionElement => {
        const questionId = questionElement.dataset.questionId;
        const selectedOption = questionElement.querySelector('.student-answer:checked');
        
        studentAnswers[questionId] = selectedOption ? parseInt(selectedOption.value) : null;
    });
    
    // Calculate score
    let totalScore = 0;
    let maxPossibleScore = 0;
    const results = [];
    
    currentExamData.questions.forEach(question => {
        maxPossibleScore += question.points;
        
        const studentAnswer = studentAnswers[question.id];
        let questionResult = '';
        let pointsEarned = 0;
        
        if (studentAnswer === null) {
            questionResult = 'Not answered';
            pointsEarned = 0;
        } else if (studentAnswer === question.correctAnswer) {
            questionResult = 'Correct';
            pointsEarned = question.points;
        } else {
            questionResult = 'Incorrect';
            pointsEarned = -question.points * currentExamData.negativeMarking;
        }
        
        totalScore += pointsEarned;
        
        results.push({
            question: question.text,
            correctAnswer: question.options.find(o => o.id === question.correctAnswer).text,
            studentAnswer: studentAnswer ? question.options.find(o => o.id === studentAnswer).text : 'Not answered',
            result: questionResult,
            points: pointsEarned.toFixed(2),
            maxPoints: question.points
        });
    });
    
    // Display results
    displayResults(results, totalScore, maxPossibleScore);
}

// Display results
function displayResults(results, totalScore, maxPossibleScore) {
    studentPanel.classList.add('hidden');
    resultsPanel.classList.remove('hidden');
    currentView = 'results';
    
    const percentage = ((totalScore / maxPossibleScore) * 100).toFixed(2);
    const passed = percentage >= 60; // Assuming 60% is passing
    
    let resultsHtml = `
        <div class="text-center mb-4">
            <h3 class="${passed ? 'text-success' : 'text-danger'}">
                ${passed ? '<i class="fas fa-check-circle me-2"></i>' : '<i class="fas fa-times-circle me-2"></i>'}
                Your Score: ${totalScore.toFixed(2)} / ${maxPossibleScore} (${percentage}%)
            </h3>
            <div class="progress mb-3" style="height: 25px;">
                <div class="progress-bar ${passed ? 'bg-success' : 'bg-danger'}" role="progressbar" 
                     style="width: ${percentage}%" aria-valuenow="${percentage}" 
                     aria-valuemin="0" aria-valuemax="100">
                    ${percentage}%
                </div>
            </div>
            <h4 class="${passed ? 'text-success' : 'text-danger'}">
                ${passed ? 'Congratulations! You passed!' : 'Sorry, you did not pass.'}
            </h4>
        </div>
        
        <h5 class="mb-3">Detailed Results:</h5>
        <div class="table-responsive">
            <table class="table table-bordered results-table">
                <thead class="table-light">
                    <tr>
                        <th>Question</th>
                        <th>Your Answer</th>
                        <th>Correct Answer</th>
                        <th>Result</th>
                        <th>Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(result => `
                        <tr class="${result.result === 'Correct' ? 'correct' : result.result === 'Incorrect' ? 'incorrect' : 'unanswered'}">
                            <td>${result.question}</td>
                            <td>${result.studentAnswer}</td>
                            <td>${result.correctAnswer}</td>
                            <td>
                                ${result.result === 'Correct' ? 
                                    '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Correct</span>' : 
                                  result.result === 'Incorrect' ? 
                                    '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Incorrect</span>' : 
                                    '<span class="badge bg-secondary"><i class="fas fa-question me-1"></i>Not answered</span>'}
                            </td>
                            <td>${result.points} / ${result.maxPoints}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultsDetails.innerHTML = resultsHtml;
}

// Back to admin panel
backToAdminBtn.addEventListener('click', () => {
    resultsPanel.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    currentView = 'admin';
    window.history.pushState({}, document.title, window.location.pathname);
});

// Print exam (without answers)
printExamBtn.addEventListener('click', () => {
    if (!examId || !currentExamData) {
        showAlert('Please save the exam first', 'danger');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${currentExamData.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .question { margin-bottom: 25px; }
                    .options { margin-left: 20px; }
                    .page-break { page-break-after: always; }
                    .no-print { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${currentExamData.title}</h1>
                    <p>Duration: ${currentExamData.duration} minutes</p>
                    <hr>
                </div>
                
                ${currentExamData.questions.map((question, index) => `
                    <div class="question ${index % 5 === 0 && index !== 0 ? 'page-break' : ''}">
                        <p><strong>${question.id}. ${question.text}</strong> (${question.points} point${question.points > 1 ? 's' : ''})</p>
                        <div class="options">
                            ${question.options.map(option => `
                                <p>${String.fromCharCode(64 + option.id)}. ${option.text}</p>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    };
                </script>
            </body>
        </html>
    `);
});

// Print exam with answers
printExamWithAnswersBtn.addEventListener('click', () => {
    if (!examId || !currentExamData) {
        showAlert('Please save the exam first', 'danger');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${currentExamData.title} (With Answers)</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .question { margin-bottom: 25px; }
                    .options { margin-left: 20px; }
                    .correct { color: green; font-weight: bold; }
                    .page-break { page-break-after: always; }
                    .no-print { display: none; }
                    .answer-key { background-color: #f8f9fc; padding: 20px; margin-top: 30px; border-top: 2px solid #333; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${currentExamData.title} (Answer Key)</h1>
                    <p>Duration: ${currentExamData.duration} minutes</p>
                    <p>Negative Marking: ${currentExamData.negativeMarking * 100}% per wrong answer</p>
                    <hr>
                </div>
                
                ${currentExamData.questions.map((question, index) => `
                    <div class="question ${index % 5 === 0 && index !== 0 ? 'page-break' : ''}">
                        <p><strong>${question.id}. ${question.text}</strong> (${question.points} point${question.points > 1 ? 's' : ''})</p>
                        <div class="options">
                            ${question.options.map(option => `
                                <p class="${option.id === question.correctAnswer ? 'correct' : ''}">
                                    ${String.fromCharCode(64 + option.id)}. ${option.text}
                                    ${option.id === question.correctAnswer ? ' (Correct Answer)' : ''}
                                </p>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                
                <div class="answer-key">
                    <h3>Answer Key Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Question</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Correct Answer</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Points</th>
                        </tr>
                        ${currentExamData.questions.map(question => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${question.id}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${String.fromCharCode(64 + question.correctAnswer)}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${question.points}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    };
                </script>
            </body>
        </html>
    `);
});

// Toggle between admin and student views
fabToggle.addEventListener('click', () => {
    if (currentView === 'admin' && examId) {
        showLoading();
        loadExamForStudent(examId);
    } else if (currentView === 'student' || currentView === 'results') {
        resultsPanel.classList.add('hidden');
        studentPanel.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        currentView = 'admin';
    }
});

// Initialize
checkUrlForExam();