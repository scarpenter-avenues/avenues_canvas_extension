const urlParams = new URL(window.location.href);
const BASE_URL = urlParams.searchParams.get("base_url");
const COURSE_ID = urlParams.searchParams.get("course_id");

let rollup_data = null;
const rollups_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/outcome_rollups?per_page=100`;

let sections = {};
let student_sections = {};

getOutcomeRollups(rollups_url);

async function getOutcomeRollups(url) {
    try {
        
        let params = new URLSearchParams({include: ['outcomes', 'users', 'outcome_groups', 'outcomes.alignments']}).toString();
        // Fetch the outcome rollups and sections data concurrently
        const [rollupsResponse, sectionsResponse] = await Promise.all([
            fetch(`${url}&${params}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }).then(response => response.json()),
            
            fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/sections?include[]=students`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                params: new URLSearchParams({ include: ['students'] })
            }).then(response => response.json())
        ]);

        // Process the sections data
        sectionsResponse.forEach(section => {
            if (section.students) {
                sections[section.id] = {
                    name: section.name,
                    students: section.students
                };
                section.students.forEach(student => {
                    student_sections[student.id] = section.id;
                });
            }
        });

        // Merge or initialize rollup_data
        if (!rollup_data) {
            rollup_data = rollupsResponse;
        } else {
            rollup_data.rollups = rollup_data.rollups.concat(rollupsResponse.rollups);
            rollup_data.linked.users = rollup_data.linked.users.concat(rollupsResponse.linked.users);
        }

        // Remove duplicate users
        const uniqueUserIds = new Set();
        rollup_data.linked.users = rollup_data.linked.users.filter(user => {
            if (!uniqueUserIds.has(user.id)) {
                uniqueUserIds.add(user.id);
                return true;
            }
            return false;
        });

        // Remove duplicate rollups
        const uniqueRollupUserIds = new Set();
        rollup_data.rollups = rollup_data.rollups.filter(rollup => {
            if (!uniqueRollupUserIds.has(rollup.links.user)) {
                uniqueRollupUserIds.add(rollup.links.user);
                return true;
            }
            return false;
        });

        // Build the report
        build_report(rollup_data);

    } catch (error) {
        console.error('Error fetching rollups or sections:', error);
    }
}

function build_report(rollup_data) {
    
    document.getElementById("loading").hidden = true;

    document.getElementById("options-form").hidden = false;
    
    // Event listeners for showing and hiding reports
    document.querySelector('#show-outcome-reports').addEventListener('click', function (e) {
        document.querySelectorAll('.outcome-report-page').forEach(page => {
            page.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.querySelector('#show-grade-reports').addEventListener('click', function (e) {
        document.querySelectorAll('.grade-report-page').forEach(page => {
            page.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.querySelector('#show-description').addEventListener('click', function (e) {
        document.querySelectorAll('.outcome-description').forEach(desc => {
            desc.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.querySelector('#show-unscored').addEventListener('click', function (e) {
        document.querySelectorAll('.unscored').forEach(unscored => {
            unscored.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.querySelector('#show-average').addEventListener('click', function (e) {
        document.querySelectorAll('.score-th, .outcome-score').forEach(el => {
            el.style.display = this.checked ? 'table-cell' : 'none';
        });
    });

    document.querySelector('#show-assignments').addEventListener('click', function (e) {
        document.querySelectorAll('.recent-assessments-th, .recent-assessments').forEach(el => {
            el.style.display = this.checked ? 'table-cell' : 'none';
        });
    });

    document.querySelector('#show-comments').addEventListener('click', function (e) {
        document.querySelectorAll('.comments').forEach(comment => {
            comment.style.display = this.checked ? 'block' : 'none';
        });
    });

    // Append sections checkboxes
    Object.keys(sections).forEach(section_id => {
        const sectionCheckbox = `<span><input type="checkbox" id="s${section_id}--checkbox" checked> ${sections[section_id].name} &nbsp;&nbsp;&nbsp;</span>`;
        document.querySelector('#sections-list').insertAdjacentHTML('beforeend', sectionCheckbox);
        document.querySelector(`#s${section_id}--checkbox`).addEventListener('click', function () {
            document.querySelector(`#s${section_id}`).style.display = this.checked ? 'block' : 'none';
        });
        document.body.insertAdjacentHTML('beforeend', `<div id="s${section_id}"></div>`);
    });

    // Handle student select change
    document.querySelector('#student-select').addEventListener('change', function () {
        const selectedValue = this.value;
        if (selectedValue === 'ALL') {
            document.querySelectorAll('.page, .grade-report-page').forEach(page => page.style.display = 'block');
        } else {
            document.querySelectorAll('.page, .grade-report-page').forEach(page => page.style.display = 'none');
            document.querySelector(`#page--${selectedValue}`).style.display = 'block';
            document.querySelector(`#page-grades--${selectedValue}`).style.display = 'block';
        }
    });

    // Handle recent assessments column width change
    document.querySelector('#recent-assessments-width').addEventListener('input', function () {
        document.querySelector('.recent-assessments-th').style.width = `${this.value}px`;
    });

    // Process users and outcomes
    const users = {};
    const user_ids = [];
    rollup_data.linked.users.forEach(user => {
        users[user.id] = user;
        user_ids.push(user.id);
    });

    user_ids.sort((a, b) => (users[a].sortable_name > users[b].sortable_name ? 1 : -1));

    const outcomes = {};
    const alpha_outcomes = [];
    rollup_data.linked.outcomes.forEach(outcome => {
        outcomes[outcome.id] = outcome;
        alpha_outcomes.push({
            id: outcome.id,
            title: outcome.title,
            description: outcome.description
        });
    });

    //alpha_outcomes.sort((a, b) => (a.title > b.title ? 1 : -1));

    // Generate user-specific reports
    user_ids.forEach(user_id => {
        const user = users[user_id];
        document.querySelector('#student-select').insertAdjacentHTML('beforeend', `<option class="student-select" value="${user_id}">${user.name}</option>`);

        if (student_sections[user_id]) {
            const section = student_sections[user_id];
            const page = document.createElement('div');
            page.classList.add('page', 'outcome-report-page');
            page.id = `page--${user_id}`;
            page.innerHTML = `<p><span class="student-name">${user.name}</span> <span class="section-name">(${sections[section].name})</span></p>`;
            document.querySelector(`#s${section}`).append(page);

            const table = document.createElement('table');
            table.classList.add('outcome-table');
            table.id = `outcome-table--${user_id}`;
            table.innerHTML = `
                <tr>
                    <th class="outcome-th">Outcome</th>
                    <th class="score-th">Average</th>
                    <th class="recent-assessments-th">Recent Assessments</th>
                </tr>`;
            page.appendChild(table);

            const page_grades = document.createElement('div');
            page_grades.classList.add('page', 'grade-report-page');
            page_grades.id = `page-grades--${user_id}`;
            page_grades.innerHTML = `<p><span class="student-name">${user.name}</span> <span class="section-name">(${sections[section].name})</span></p>`;
            document.querySelector(`#s${section}`).append(page_grades);

            const grades_table = document.createElement('table');
            grades_table.classList.add('grades-table');
            grades_table.id = `grades-table--${user_id}`;
            grades_table.innerHTML = `
                <tr>
                    <th>Assignment</th>
                    <th>Due Date</th>
                    <th>Complete/Incomplete</th>
                    <th>Status</th>
                </tr>`;
            page_grades.appendChild(grades_table);
        }
    });

    // Generate report rows based on rollup data
    rollup_data.rollups.forEach(rollup => {
        alpha_outcomes.forEach(outcome => {
            let table = document.querySelector(`#outcome-table--${rollup.links.user}`);
            if(table){
                let row = document.createElement('tr');
                row.classList.add('outcome-row', 'unscored');
                row.id = `u${rollup.links.user}--${outcome.id}--row`;
                row.innerHTML = `
                    <td class="outcome-title-cell">
                        <div class="outcome-title">${outcome.title}</div>
                        <div class="outcome-description">${outcome.description}</div>
                    </td>
                    <td id="u${rollup.links.user}--${outcome.id}" class="outcome-score"></td>
                    <td class="recent-assessments">
                        <table id="u${rollup.links.user}--${outcome.id}--recent" class="assignment-table"></table>
                    </td>`;
                table.appendChild(row);
            }
        });

        rollup.scores.forEach(score => {
            let score_el = document.querySelector(`#u${rollup.links.user}--${score.links.outcome}`);
            if(score_el){
                score_el.textContent = score.score;
            }
        });
    });

    const assignments = {};
    const student_assignments = {};
    const student_grades = {};

    const url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments`;
    getRubrics(url, Object.keys(assignments), true);

    function getRubrics(url, assignment_ids, first_page, resolve, reject) {
        let data = {};
        
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                reject(`Error: ${response.statusText}`);
                alert("There was an error loading assignments from Canvas. Please refresh to try again.");
                return;
            }
    
            // Capture the headers first
            const linkHeader = response.headers.get('Link');
    
            // Parse the body to JSON in a separate promise
            return response.json().then(data => ({ data, linkHeader }));
        })
        .then(({ data, linkHeader }) => {
            data.forEach(assignment => {
                if (assignment.published && assignment.rubric) {
                    let rubric = {};
                    assignment.rubric.forEach(criterion => {
                        rubric[criterion.id] = criterion;
                    });
                    
                    assignments[assignment.id] = {
                        name: assignment.name,
                        rubric: rubric,
                        grading_type: assignment.grading_type
                    };
                }
            });
    
            // Handle pagination using the link header
            let next_url = null;
            if (linkHeader) {
                const links = linkHeader.split(',');
                links.forEach(link => {
                    if (link.includes('rel="next"')) {
                        next_url = link.substring(link.indexOf('<') + 1, link.indexOf('>'));
                    }
                });
            }
    
            if (!next_url) {
                submissions();
            } else {
                getRubrics(next_url, false, resolve, reject);
            }
        })
        .catch(error => {
            console.log(error);
            alert("There was an error loading assignments from Canvas. Please refresh to try again.");
        });
    }
    

    function submissions() {
        let submissionPromises = [];
        
        // Loop through assignments and create submission promises
        Object.keys(assignments).forEach(assignment_id => {
            let url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${assignment_id}/submissions`;
            submissionPromises.push(new Promise((resolve, reject) => {
                getSubmissions(url, true, resolve, reject);
            }));
        });
    
        // Add assignments to report once all promises resolve
        Promise.all(submissionPromises).then(() => {
            // Loop through student assignments and update the DOM
            Object.entries(student_assignments).forEach(([user_id, outcomes]) => {
                Object.entries(outcomes).forEach(([outcome_id, outcome]) => {
                    let row = document.querySelector(`#u${user_id}--${outcome_id}--row`);
                    if(row){
                        row.classList.remove("unscored");
                    }
                   
                    let recent = document.querySelector(`#u${user_id}--${outcome_id}--recent`);
                    if(recent){
                        // Sort outcomes based on date
                        outcome.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        
                        // Append outcomes to the recent assessments table
                        outcome.forEach(assignment => {
                            let date = new Date(assignment.datetime);
                            let assignmentRow = document.createElement('tr');
                            assignmentRow.classList.add('assignment-row');
                            if(date.getMonth() + 1 > 3 && date.getMonth() + 1 < 7){
                                assignmentRow.style.backgroundColor = "#d5f5e3"
                            }
                            assignmentRow.innerHTML = `
                                <td class="assignment-score">${assignment.score ? assignment.score : '--'}</td>
                                <td class="assignment-date">${date.getMonth() + 1}/${date.getDate()}</td>
                                <td class="assignment-title">
                                    <b>${assignment.title}</b>
                                    <span class="comments"><br/>${assignment.comments ? assignment.comments.replace(/\n/g, '<br/>') : ""}</span>
                                </td>
                            `;
                            recent.appendChild(assignmentRow);
                        });
                    };
                });
            });
    
            // Handle student grades and append to the DOM
            Object.entries(student_grades).forEach(([user_id, grades]) => {
                grades.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
                let complete = 0, incomplete = 0, late = 0;
    
                grades.forEach(grade => {
                    let date = grade.datetime ? new Date(grade.datetime) : null;
                    let display_date = date ? `${date.getMonth() + 1}/${date.getDate()}` : "";
                    let display_grade;
    
                    switch (grade.grade) {
                        case "complete":
                            display_grade = '&#10004;'; // Check mark
                            complete += 1;
                            break;
                        case "incomplete":
                            display_grade = '<span class="missing"> &#10008;</span>'; // X mark
                            incomplete += 1;
                            break;
                        case null:
                            display_grade = "not yet graded";
                            break;
                        default:
                            display_grade = grade.grade;
                    }
    
                    if (grade.status === "late") {
                        late += 1;
                    }
    
                    if (assignments[grade.assignment_id].grading_type !== 'not_graded') {
                        let gradeRow = document.createElement('tr');
                        gradeRow.classList.add('grades-row');
                        gradeRow.innerHTML = `
                            <td class="grades-assignment">${grade.title}</td>
                            <td class="grades-date">${display_date}</td>
                            <td class="grades-score">${display_grade}</td>
                            <td class="grades-score">${grade.status}</td>
                        `;
                        let table = document.querySelector(`#grades-table--${user_id}`)
                        if(table) {
                            table.appendChild(gradeRow);
                        }
                    }
                });
    
                // Append summary for the student
                let page = document.querySelector(`#page-grades--${user_id}`)
                if (page) {
                    page.insertAdjacentHTML('beforeend', `
                        <br/>
                        <p><b>Total Graded Assignments:</b> ${complete + incomplete}</p>
                        <p><b>Complete Assignments:</b> ${complete}</p>
                        <p><b>Incomplete Assignments:</b> ${incomplete}</p>
                        <p><b>Late Percentage:</b> ${Math.round(100.0 * late / (complete + incomplete), 0)}%</p>
                        <p style="page-break-after:always"><b>Missing Percentage:</b> ${Math.round(100.0 * incomplete / (complete + incomplete), 0)}%</p>
                    `);
                }
            });
        });
    }
    
    function getSubmissions(url, first_page, resolve, reject) {
        let data = {};
        if (first_page) {
            url = `${url}?per_page=100&include[]=rubric_assessment`;
        }
    
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(text => {
                    if (text === "403 Forbidden (Rate Limit Exceeded)\n" && this.retryLimit >= 0) {
                        this.retryLimit--;
                        setTimeout(() => {
                            getSubmissions(url, first_page, resolve, reject);
                        }, 1 * Math.pow(2, (10 - this.retryLimit)));
                    } else {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
                });
            }
            // Capture the link header before calling response.json()
            const linkHeader = response.headers.get('Link');
            return response.json().then(data => ({ data, linkHeader })); // Return both data and linkHeader
        })
        .then(({ data, linkHeader }) => {
            // Add data to student_assignments dict
            data.forEach(submission => {
                if(submission.rubric_assessment){
                    Object.entries(submission.rubric_assessment).forEach(([criterion_id, assessment]) => {
                        if (!assignments[submission.assignment_id].rubric) return;
                        if (!assignments[submission.assignment_id].rubric[criterion_id]) return;
                        const outcome_id = assignments[submission.assignment_id].rubric[criterion_id].outcome_id;
                        const assignment = {
                            assignment_id: submission.assignment_id,
                            title: assignments[submission.assignment_id].name,
                            score: assessment.points,
                            comments: assessment.comments,
                            datetime: assessment.submitted_at || submission.graded_at || submission.cached_due_date
                        };
    
                        if (!student_assignments[submission.user_id]) {
                            student_assignments[submission.user_id] = {};
                        }
    
                        if (!student_assignments[submission.user_id][outcome_id]) {
                            student_assignments[submission.user_id][outcome_id] = [];
                        }
    
                        student_assignments[submission.user_id][outcome_id].push(assignment);
                    });
    
                    // Add data to student_grades dict
                    let status = "";
                    if (submission.late && submission.grade === 'complete') {
                        status = 'late';
                    }
                    if (submission.excused) {
                        submission.grade = 'excused';
                    }
    
                    const grade = {
                        assignment_id: submission.assignment_id,
                        title: assignments[submission.assignment_id].name,
                        datetime: submission.cached_due_date,
                        grade: submission.grade,
                        status: status
                    };
    
                    if (!student_grades[submission.user_id]) {
                        student_grades[submission.user_id] = [];
                    }
    
                    student_grades[submission.user_id].push(grade);
                }
            });
    
            // Handle pagination
            if (linkHeader) {
                const links = linkHeader.split(',');
                let next_url = null;
                links.forEach(link => {
                    if (link.includes('rel="next"')) {
                        next_url = link.substring(link.indexOf('<') + 1, link.indexOf('>'));
                    }
                });
                if (!next_url) {
                    resolve(true);
                } else {
                    console.log('Getting more results...');
                    getSubmissions(next_url, false, resolve, reject);
                }
            } else {
                resolve(true);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            reject(error);
        });
    }
    
    
}



