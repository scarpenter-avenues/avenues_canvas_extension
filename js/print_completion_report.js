let url = new URL(window.location.href);
let BASE_URL = url.searchParams.get("base_url");
let COURSE_ID = url.searchParams.get("course_id");

let rollup_data = null;
let rollups_url = "https://"+BASE_URL+"/api/v1/courses/"+COURSE_ID+"/outcome_rollups?per_page=100";

let submissions_url

let sections = {}
let student_sections = {}

let assignments = {}
let student_assignments = {}
let student_grades = {}


let retryLimit = 10; // Define retryLimit globally or manage it inside the function as needed

getOutcomeRollups(rollups_url)

function getOutcomeRollups(url) {
    Promise.all([
        fetch(url + '?include[]=outcomes&include[]=users&include[]=outcome_groups&include[]=outcomes.alignments', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => response.json())
        .catch(error => console.log(error)),

        fetch("https://" + BASE_URL + "/api/v1/courses/" + COURSE_ID + "/sections?include[]=students", {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(response => response.json())
        .catch(error => console.log(error))
    ])
    .then(function([data, sectionsData]) {
        sectionsData.forEach(function(section) {
            if (section.students) {
                sections[section.id] = {
                    name: section.name,
                    students: section.students
                };
                section.students.forEach(function(student) {
                    student_sections[student.id] = section.id;
                });
            }
        });

        if (!rollup_data) {
            rollup_data = data;
        } else {
            rollup_data.rollups = rollup_data.rollups.concat(data.rollups);
            rollup_data.linked.users = rollup_data.linked.users.concat(data.linked.users);
        }

        // Remove duplicate users
        let uniqueUserIds = new Set();
        rollup_data.linked.users = rollup_data.linked.users.filter(user => {
            if (!uniqueUserIds.has(user.id)) {
                uniqueUserIds.add(user.id);
                return true;
            }
            return false;
        });

        // Remove duplicate rollups
        uniqueUserIds = new Set();
        rollup_data.rollups = rollup_data.rollups.filter(rollup => {
            if (!uniqueUserIds.has(rollup.links.user)) {
                uniqueUserIds.add(rollup.links.user);
                return true;
            }
            return false;
        });

        build_report(rollup_data);
    });
}

function build_report(rollup_data) {
    // Create and append the options form
    let optionsForm = document.createElement('form');
    optionsForm.id = 'options-form';
    optionsForm.className = 'no-print';
    optionsForm.innerHTML = `
        <h2>Student Assignment Completion Report
        <h3>Display Options</h3>
        <div class="form-element" id="sections-list">
            <label>Show sections: </label>
        </div>
        <div class="form-element" id="student-select-container">
            <label>Select student: </label>
            <select id="student-select">
                <option class="student-select" value="ALL">Show all students in selected section</option>
            </select>
        </div>`;
    document.body.appendChild(optionsForm);

    // Process each section
    Object.keys(sections).forEach(section_id => {
        let section = sections[section_id];
        let sectionContainer = document.getElementById('sections-list');
        let span = document.createElement('span');
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${section_id}--checkbox`;
        checkbox.checked = true;
        span.appendChild(checkbox);
        span.appendChild(document.createTextNode(`${section.name} \u00A0\u00A0\u00A0`));
        sectionContainer.appendChild(span);
        
        checkbox.addEventListener('click', function (e) {
            let sectionDiv = document.getElementById(section_id);
            sectionDiv.style.display = this.checked ? 'block' : 'none';
        });

        let sectionDiv = document.createElement('div');
        sectionDiv.id = section_id;
        document.body.appendChild(sectionDiv);
    });

    // Change event for student select
    let studentSelect = document.getElementById('student-select');
    studentSelect.addEventListener('change', function () {
        let pages = document.querySelectorAll('.page');
        if (this.value === "ALL") {
            pages.forEach(page => page.style.display = 'block');
        } else {
            pages.forEach(page => page.style.display = 'none');
            let page = document.getElementById(`page-grades--${this.value}`)
            if(page){
                page.style.display = 'block';
            }
        }
    });

    // User processing
    let users = {};
    let user_ids = rollup_data.linked.users.map(user => {
        users[user.id] = user;
        return user.id;
    });

    user_ids.sort((a, b) => {
        return users[a].sortable_name.localeCompare(users[b].sortable_name);
    });

    user_ids.forEach(user_id => {
        let user = users[user_id];
        let option = document.createElement('option');
        option.className = 'student-select';
        option.value = user_id;
        option.textContent = user.name;
        studentSelect.appendChild(option);

        // Create user report
        if (student_sections[user_id]) {
            let section = student_sections[user_id];
            let pageGrades = document.createElement('div');
            pageGrades.className = 'page grade-report-page';
            pageGrades.id = `page-grades--${user_id}`;
            document.getElementById(section).appendChild(pageGrades);

            let p = document.createElement('p');
            p.innerHTML = `<span class="student-name">${user.name}</span> <span class="section-name">(${sections[section].name})</span>`;
            pageGrades.appendChild(p);

            let gradesTable = document.createElement('table');
            gradesTable.className = 'grades-table';
            gradesTable.id = `grades-table--${user_id}`;
            gradesTable.innerHTML = `<tr>
                <th>Assignment</th>
                <th>Due Date</th>
                <th>Complete/Incomplete</th>
                <th>Status</th>
            </tr>`;
            pageGrades.appendChild(gradesTable);
        }
    });

    // Handle network requests for assignments and submissions
    getAssignments(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments`, [Object.keys(assignments)], true);
}


function getAssignments(url, assignment_ids, first_page) {
    return new Promise((resolve, reject) => {

        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            // Extract the Link header for pagination
            let linkHeader = response.headers.get('Link');
            let next_url = null;
            if (linkHeader) {
                linkHeader.split(',').forEach(link => {
                    if (link.includes('rel="next"')) {
                        next_url = link.substring(link.indexOf('<') + 1, link.indexOf('>'));
                    }
                });
            }
            return response.json().then(data => ({ data, next_url }));
        })
        .then(({ data, next_url }) => {
            data.forEach(assignment => {
                if (assignment.published && assignment.grading_type !== 'not_graded') {
                    assignments[assignment.id] = {
                        name: assignment.name,
                    };
                }
            });

            if (!next_url) {
                resolve();  // Resolve when there's no more pagination
                submissions(); // Assuming this function needs to be called after fetching all pages
            } else {
                getAssignments(next_url, assignment_ids, false).then(resolve).catch(reject);  // Recursively call and chain the resolve/reject
            }
        })
        .catch(error => {
            console.log('Error: ' + error.message);
            if (error.message.includes("Rate Limit Exceeded") && retryLimit > 0) {
                setTimeout(() => {
                    retryLimit--;
                    getAssignments(url, assignment_ids, first_page).then(resolve).catch(reject);  // Ensure resolve and reject are passed here as well
                }, 1000 * Math.pow(2, 10 - retryLimit)); // Exponential backoff
            } else {
                console.error('Failed to load data:', error);
                reject(error);  // Reject the promise if an error occurs
                alert("There was an error loading assignments from Canvas. Please refresh to try again.");
            }
        });
    });
}



function submissions() {
    let submissionPromises = [];

    Object.keys(assignments).forEach(assignment_id => {
        let url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${assignment_id}/submissions`;
        submissionPromises.push(getSubmissions(url, true)); // No need for the inner promise wrapper, since `getSubmissions` already returns a promise
    });

    // Add assignments to report
    Promise.all(submissionPromises).then(() => {
        Object.keys(student_grades).forEach(user_id => {
            let grades = student_grades[user_id];
            grades.sort((a, b) => {
                return new Date(a.datetime) - new Date(b.datetime);
            });

            let complete = 0;
            let incomplete = 0;
            let late = 0;

            grades.forEach(grade => {
                let date = grade.datetime ? new Date(grade.datetime) : null;
                let displayDate = date ? `${date.getMonth() + 1}/${date.getDate()}` : "";

                let displayGrade;
                switch (grade.grade) {
                    case "complete":
                        displayGrade = '&#10004;'; // Check mark
                        complete++;
                        break;
                    case "incomplete":
                        displayGrade = '<span class="missing"> &#10008;</span>'; // X mark
                        incomplete++;
                        break;
                    case null:
                        displayGrade = "not yet graded";
                        break;
                    default:
                        displayGrade = grade.grade;
                }
                if (grade.status === "late") {
                    late++;
                }

                let gradesTable = document.getElementById(`grades-table--${user_id}`);
                if(gradesTable){
                    let tr = document.createElement('tr');
                    tr.className = 'grades-row';
                    tr.innerHTML = `
                        <td class="grades-assignment">${grade.title}</td>
                        <td class="grades-date">${displayDate}</td>
                        <td class="grades-score">${displayGrade}</td>
                        <td class="grades-status">${grade.status}</td>
                    `;
                    gradesTable.appendChild(tr);
                }
            });

            let pageGrades = document.getElementById(`page-grades--${user_id}`);
            if(pageGrades){
                pageGrades.innerHTML += `<br/>
                    <p><b>Total Graded Assignments:</b> ${complete + incomplete}</p>
                    <p><b>Complete Assignments:</b> ${complete}</p>
                    <p><b>Incomplete Assignments:</b> ${incomplete}</p>
                    <p><b>Late Percentage:</b> ${Math.round(100 * late / (complete + incomplete))}%</p>
                    <p style="page-break-after:always"><b>Missing Percentage:</b> ${Math.round(100 * incomplete / (complete + incomplete))}%</p>
                `;
            }
        });
    }).catch(error => {
        console.error("Error with submission promises:", error);
    });
}

function getSubmissions(url, first_page) {
    return new Promise((resolve, reject) => {
        let params = new URLSearchParams();
        if (first_page) {
            params.append('per_page', '100');
        }

        fetch(url + (params.toString() ? `?${params.toString()}` : ''), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("403 Forbidden (Rate Limit Exceeded)");
                } else {
                    throw new Error('HTTP error, status = ' + response.status);
                }
            }
            return response.json().then(data => ({
                data: data,
                headers: response.headers
            }));
        })
        .then(({ data, headers }) => {
            // Process submission data
            data.forEach(submission => {
                let status = "";
                if (submission.late) {
                    if (submission.grade === 'complete') {
                        status = "late";
                    }
                }
                if (submission.excused) {
                    submission.grade = 'excused';
                }
                let grade = {
                    assignment_id: submission.assignment_id,
                    title: assignments[submission.assignment_id].name,
                    datetime: submission.cached_due_date,
                    grade: submission.grade,
                    status: status
                };
                if (!(submission.user_id in student_grades)) {
                    student_grades[submission.user_id] = [];
                }
                student_grades[submission.user_id].push(grade);
            });

            // Handle pagination
            let linkHeader = headers.get('Link');
            let next_url = null;
            if (linkHeader) {
                linkHeader.split(',').forEach(part => {
                    if (part.includes('rel="next"')) {
                        next_url = part.substring(part.indexOf('<') + 1, part.indexOf('>'));
                    }
                });
            }
            if (!next_url) {
                resolve(true); // Resolve when no more pages
            } else {
                console.log('Getting more results...');
                getSubmissions(next_url, false).then(resolve).catch(reject); // Recursively call the function and chain resolve/reject
            }
        })
        .catch(error => {
            console.log('Error: ' + error.message);
            if (error.message === "403 Forbidden (Rate Limit Exceeded)" && retryLimit > 0) {
                setTimeout(() => {
                    retryLimit--;
                    getSubmissions(url, first_page).then(resolve).catch(reject); // Retry with exponential backoff
                }, 1000 * Math.pow(2, 10 - retryLimit)); // Exponential backoff
            } else {
                reject(error); // Reject the promise if there's an error
            }
        });
    });
}
