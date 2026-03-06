// Extract query parameters
const urlParams = new URLSearchParams(window.location.search);
const BASE_URL = urlParams.get("base_url");
const course_id = urlParams.get("course_id");
const assignment_id = urlParams.get("assignment_id");
const submission_url = `https://${BASE_URL}/api/v1/courses/${course_id}/assignments/${assignment_id}/submissions?include[]=rubric_assessment&include[]=assignment&include[]=user&include[]=submission_comments`;

let submissions = [];
let student_sections = {};
let sections = {};

// Fetch sections
fetch(`https://${BASE_URL}/api/v1/courses/${course_id}/sections?include[]=students`)
    .then(response => response.json())
    .then(data => {
        data.forEach(section => {
            if (section.students) {
                sections[section.id] = section.name;
                document.body.insertAdjacentHTML('beforeend', `<div id="section--${section.id}"></div>`);
                section.students.forEach(student => {
                    student_sections[student.id] = section.id;
                });
            }
        });

        // Fetch submissions
        getSubmissions(submission_url);
    })
    .catch(error => console.log(error));


function getSubmissions(url, last_page = false) {
    fetch(url)
        .then(response => {
            const linkHeader = response.headers.get('Link');
            return response.json().then(data => ({ data, linkHeader }));
        })
        .then(({ data, linkHeader }) => {
            submissions = submissions.length ? submissions.concat(data) : data;

            let next_url = null;
            if (linkHeader) {
                linkHeader.split(',').forEach(link => {
                    if (link.includes('rel="next"')) {
                        next_url = link.substring(link.indexOf('<') + 1, link.indexOf('>'));
                    }
                });
            }

            if (!next_url) {
                generatePage(submissions);
            } else {
                console.log('Getting more results...');
                getSubmissions(next_url);
            }
        })
        .catch(error => console.log('Error fetching submissions:', error));
}


// Generate the page with submissions
function generatePage(data) {
    document.getElementById("loading").hidden = true;

    data.sort((a, b) => a.user.sortable_name.localeCompare(b.user.sortable_name));

    const optionsForm = document.createElement('form');
    optionsForm.id = 'options-form';
    optionsForm.classList.add('no-print');
    optionsForm.innerHTML = `
        <h2>Display Options</h2>
        <div class="form-element"><input type="checkbox" id="show-description"> Print assignment description.</div>
        <div class="form-element"><input type="checkbox" id="show-long-description"> Print outcome descriptions.</div>
        <br/>
        <div class="form-element" id="sections-list">
            <label><b>Show sections:</b> </label>
        </div>
        <br/>
        <p><b>Show/hide rubric columns</b></p>
    `;
    document.body.prepend(optionsForm);

    // Add sections and checkboxes
    Object.keys(sections).forEach(section_id => {
        const sectionName = sections[section_id];
        const sectionList = document.getElementById('sections-list');
        const span = document.createElement('span');
        const checkbox = document.createElement('input');
        checkbox.classList.add('section-checkbox');
        checkbox.type = 'checkbox';
        checkbox.id = `${section_id}--checkbox`;
        checkbox.value = `section--${section_id}`
        checkbox.defaultChecked = true;

        span.appendChild(checkbox);
        span.appendChild(document.createTextNode(`${sectionName} \u00A0\u00A0\u00A0`));
        sectionList.appendChild(span);

        
    });

    // Add rubric criteria options
    const optionsRatingsTable = document.createElement('table');
    optionsRatingsTable.classList.add('options-ratings-table');
    optionsForm.appendChild(optionsRatingsTable);

    data[0].assignment.rubric.forEach(criteria => {
        const row = document.createElement('tr');
        optionsRatingsTable.appendChild(row);
        row.innerHTML = `<td>${criteria.description}</td>`;

        criteria.ratings.forEach(rating => {
            const checkboxTd = document.createElement('td');
            checkboxTd.innerHTML = `<input type="checkbox" class="rating-checkbox" value="${criteria.id}--${rating.points}"> ${rating.points}`;
            row.appendChild(checkboxTd);
        });

        row.innerHTML += `<td><input type="checkbox" class="rating-checkbox" value="${criteria.id}--comment" checked> comment</td>`;
    });

    optionsForm.innerHTML += `<p><b>Comment column width</b><br/><input type="range" min="150" max="700" value="150" class="slider" id="comment-width"></p>`;

    const rubric = {};
    data[0].assignment.rubric.forEach(rubricRow => {
        rubric[rubricRow.id] = rubricRow;
    });

    // Create submissions page
    data.forEach(submission => {
        if ('rubric_assessment' in submission) {
            const section_id = student_sections[submission.user.id];
            const sectionDiv = document.getElementById(`section--${section_id}`);
            if(!sectionDiv){
                return
            }    
            const page = document.createElement('div');
            page.classList.add('page');
            page.id = submission.user.sortable_name;
            sectionDiv.appendChild(page);

            page.innerHTML = `
                <h1 class="assignment-name">${submission.assignment.name}</h1>
                <p><span class="student-name">${submission.user.name}</span> <span class="section-name">(${sections[section_id]})</span></p>
                <div class="assignment-description" hidden>${submission.assignment.description}</div>
                <table class="rubric-table">
                    <tr>
                        <th class="criteria-th left">Outcome</th>
                        <th class="ratings-th"></th>
                        <th class="points-th points"></th>
                        <th class="comment-th left">Comments</th>
                    </tr>
                </table>
            `;

            const table = page.querySelector('.rubric-table');

            Object.entries(submission.rubric_assessment).forEach(([c_id, assessment]) => {
                if (rubric[c_id]) {
                    const row = document.createElement('tr');
                    row.classList.add('rubric-row');
                    table.appendChild(row);

                    row.innerHTML = `
                        <td>
                            <div><b>${rubric[c_id].description}</b></div>
                            <div class="criteria-long-description" hidden>${rubric[c_id].long_description}</div>
                        </td>
                        <td class="ratings-table-container"></td>
                        <td class="points">${assessment.points || ""}</td>
                        <td class="comments ${c_id}--comment">${assessment.comments.replace(/\n/g, '<br/>')}</td>
                    `;

                    const ratingsTableContainer = row.querySelector('.ratings-table-container');
                    const ratingsTable = document.createElement('table');
                    ratingsTable.classList.add('ratings-table');
                    ratingsTableContainer.appendChild(ratingsTable);

                    const ratingsRow = document.createElement('tr');
                    ratingsTable.appendChild(ratingsRow);

                    rubric[c_id].ratings.forEach(rating => {
                        const ratingTd = document.createElement('td');
                        ratingTd.classList.add(`${c_id}--${rating.points}`);
                        ratingTd.innerHTML = `
                            <div class="description">${rating.description}</div>
                            <div class="ratings-points">${rating.points} pts</div>
                        `;
                        ratingTd.hidden = true;
                        ratingsRow.appendChild(ratingTd);

                        if (assessment.points === rating.points) {
                            ratingTd.classList.add('highlight');
                        }
                    });
                } else {
                    console.log("Error: criteria id not in rubric???");
                }
            });

            const addComments = document.createElement('div');
            addComments.classList.add('add-comments');
            page.appendChild(addComments);

            addComments.innerHTML = `<p class="submission-comment"><b><u>Submission Comments</u></b></p>`;

            submission.submission_comments.forEach(comment => {
                addComments.innerHTML += `<p class="submission-comment"><b>${comment.author_name}</b>: ${comment.comment}</p>`;
            });
        }
    });

    // Handle input and checkbox events
    document.getElementById('comment-width').addEventListener('input', function() {
        document.querySelectorAll('.comment-th').forEach(th => {
            th.style.width = `${this.value}px`;
        });
    });

    document.getElementById('show-description').addEventListener('change', function() {
        document.querySelectorAll('.assignment-description').forEach(desc => {
            desc.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.getElementById('show-long-description').addEventListener('change', function() {
        document.querySelectorAll('.criteria-long-description').forEach(desc => {
            desc.style.display = this.checked ? 'block' : 'none';
        });
    });

    document.querySelectorAll('.section-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', () => {
            const sectionDiv = document.getElementById(checkbox.value);
            sectionDiv.style.display = checkbox.checked ? 'block' : 'none';
        });
    });

    document.querySelectorAll('.rating-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            document.querySelectorAll(`.${this.value}`).forEach(cell => {
                cell.style.display = this.checked ? 'table-cell' : 'none';
            });
        });
    });
}
