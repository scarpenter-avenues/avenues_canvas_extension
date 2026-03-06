const urlParams = new URL(window.location.href);
const BASE_URL = urlParams.searchParams.get("base_url");
const COURSE_ID = urlParams.searchParams.get("course_id");

let ASSIGNMENT_ID = urlParams.searchParams.get("assignment_id");

let ASSIGNMENT_NAME;
let DUE_AT;
let RUBRIC;
let RUBRIC_ASSOCIATION_ID;
sections = {};
outcomes = {};
let assignment_students;
let active_outcomes;
// rubric_assessments store the ids of rubric assessments.
// key: student id
// value: rubric_assessment id
let rubric_assessments;
let ASSIGNMENTS = {};

//Comment icons

let comment_icon_filled = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#7f7f7f" class="comment-icon" viewBox="0 0 16 16">
            <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4.414a1 1 0 0 0-.707.293L.854 15.146A.5.5 0 0 1 0 14.793zm3.5 1a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1z"/>
        </svg>
    `
let comment_icon_unfilled = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="comment-icon" viewBox="0 0 16 16">
            <path fill="currentColor" d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
            <path fill="currentColor" d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5M3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6m0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
        </svg>
    `

let check_icon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="grade-icon" viewBox="0 0 16 16">
            <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
        </svg>
    `

let x_icon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="grade-icon" viewBox="0 0 16 16">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
        </svg>
    `

let dash_icon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="grade-icon" viewBox="0 0 16 16">
            <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8"/>
        </svg>
    `


getCourseData();
setup();

document.getElementById("create_assignment").addEventListener("click", e => {
    e.preventDefault();
    let title = document.getElementById("assignment_title").value;
    let date = new Date(document.getElementById("assignment_date").value);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    date = toIsoString(date);
    if(title.trim() != "" && date.trim() != ""){
        document.getElementById("assignment_title").disabled = true;
        document.getElementById("assignment_date").disabled = true;
        createAssignment(title, date);
    }
})

window.onbeforeunload = saveFocused;

async function getCourseData() {
    try {
        // Fetch the outcome rollups and sections data concurrently
        const [outcomesResponse, sectionsResponse, assignmentsResponse] = await Promise.all([
            paginatedFetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/outcome_group_links?outcome_style=full`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            }),
            
            paginatedFetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/sections?include[]=students&include[]=enrollments`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                params: new URLSearchParams({ include: ['students'] })
            }),

            paginatedFetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments?per_page=100&order_by=due_at&include[]=overrides`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                params: new URLSearchParams({ include: ['students'] })
            })
        ]);

        if( sectionsResponse.status == "unauthenticated" ||
            outcomesResponse.status == "unauthenticated" ||
            assignmentsResponse.status == "unauthenticated"
        ){
            alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
            return;
        }

        processSections(sectionsResponse);
        
        processOutcomes(outcomesResponse);

        processAssignments(assignmentsResponse);

        document.getElementById("loading").classList.add("hidden");
        document.getElementById("form").classList.remove("hidden");

    } catch (error) {
        console.error('Error fetching rollups or sections:', error);
    }

}

function setup(){
    // ASSIGNMENT_ID = null;
    ASSIGNMENT_NAME = null;
    DUE_AT = null;
    RUBRIC = null;
    RUBRIC_ASSOCIATION_ID = null;
    assignment_students = {};
    active_outcomes = [];
    rubric_assessments = {};

    // SETUP UI
    Date.prototype.toDateInputValue = function () {
        var local = new Date(this);
        local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
        return local.toJSON().slice(0, 10);
    };
    document.getElementById('assignment_date').value = new Date().toDateInputValue();
    
    document.getElementById("assignment_title").disabled = false;
    document.getElementById("assignment_title").innerHTML = "";
    document.getElementById("assignment_title").value = null;
    document.getElementById("assignment_date").disabled = false;

    document.getElementById("assignment_buttons").classList.add("hidden");
    document.getElementById("create_assignment").classList.remove("hidden");
    document.getElementById("publish").classList.remove("hidden");
    document.getElementById("publish-unclicked").classList.remove("hidden");
    document.getElementById("publish-clicked").classList.add("hidden");
    document.getElementById("unpublish-nohover").classList.remove("hidden");
    document.getElementById("unpublish-hover").classList.add("hidden");
    document.getElementById("unpublish-clicked").classList.add("hidden");
    document.getElementById("unpublish").classList.add("hidden");
    document.getElementById("delete-unclicked").classList.remove("hidden");
    document.getElementById("delete-clicked").classList.add("hidden");

    document.getElementById("grade_table").classList.add("hidden");
    refreshGradeTable();
    document.getElementById("grade_table").querySelectorAll(".student-row").forEach(row => {
        row.remove();
    });
    document.getElementById("grade_table").querySelectorAll(".outcome-header").forEach(th => {
        th.remove();
    });

}

function processSections(sectionsResponse){
    let student_select = document.getElementById("student_select");
    sectionsResponse.forEach(section => {
        if (section.students) {
            sections[section.id] = {
                name: section.name,
                students: []
            }
            section.students.sort((a, b) => a.sortable_name.toLowerCase().localeCompare(b.sortable_name.toLowerCase()));
            section.students.forEach(student => {
                let active = false;
                student.enrollments.some(enrollment => {
                    if(enrollment.enrollment_state == "active"){
                        active = true;
                        return true
                    }
                })
                if(active){
                    sections[section.id].students.push({
                        id: student.id,
                        name: student.name
                    });
                }
            });
            

            // Add sections to section_select filter
            let section_option = document.createElement('option');
            section_option.value = `section_${section.id}`;
            section_option.innerHTML = `${section.name}`;
            document.getElementById("section_select").append(section_option);

            // Add section to section/student dropdown
            document.getElementById("section_optgroup").append(section_option.cloneNode(true));

            // Add section optgroup to section/student dropdown
            let section_optgroup = document.createElement('optgroup');
            section_optgroup.label = section.name;
            student_select.append(section_optgroup);
            student_select.append(document.createElement('hr'))


            // Add section students to section/student dropdown
            section.students.forEach(student => {
                let student_option = document.createElement('option');
                student_option.value = `student_${student.id}`;
                student_option.innerHTML = student.name;
                section_optgroup.append(student_option);

            });
        }
    });

    // Change handler for section_select filter
    document.getElementById("section_select").addEventListener("change", e => {
        e.preventDefault();
        if(e.target.value == "all"){
            document.querySelectorAll(".student-row").forEach(row => {
                row.classList.remove("hidden");
            });
            return;
        }
        document.querySelectorAll(".student-row").forEach(row => {
            row.classList.add("hidden");
        });
        let id = parseInt(e.target.value.split("_")[1]);
        sections[id].students.forEach(student => {
            document.getElementById(`row_${student.id}`).classList.remove("hidden");
        });
    });

    //Change handler for section/student
    student_select.addEventListener("change", e => {
        // If adding an entire section
        let id = parseInt(e.target.value.split("_")[1]);
        if(e.target.value.split("_")[0] == "section"){
            sections[id].students.forEach(student => {
                if(!(student.id in assignment_students)){
                    addStudentToAssignment.then(override => {
                        assignment_students[student_id] = override.id;
                        createStudentRow(student, true);
                    });
                    
                    
                    for(let option of e.target.options){
                        if(option.value == `student_${student.id}`){
                            option.disabled = true;
                        }
                    };
                }
            });
            e.target.options[e.target.selectedIndex].disabled = true;
            e.target.selectedIndex = 0;
        }
        // else adding one single student
        else{
            if(!(id in assignment_students)){
                let student = {
                    id: id,
                    name: e.target.options[e.target.selectedIndex].text
                }
                addStudentToAssignment(student).then(override => {
                    assignment_students[id] = override.id;
                    createStudentRow(student, false);
                });
            }
            e.target.options[e.target.selectedIndex].disabled = true;
            e.target.selectedIndex = 0;
        }
    });
}

function processOutcomes(outcomesResponse){
    //Process the outcomes data
    let outcome_select = document.getElementById("outcome_select");
    outcomesResponse.forEach(outcome => {
        outcomes[outcome.outcome.id] = {
            id: outcome.outcome.id,
            display_name: outcome.outcome.display_name,
            points_possible: outcome.outcome.points_possible,
            description: outcome.outcome.description,
            mastery_points: outcome.outcome.mastery_points,
            ratings: outcome.outcome.ratings
        };
        // Add outcome to outcome_select
        let outcome_option = document.createElement('option');
        outcome_option.value = `outcome_${outcome.outcome.id}`;
        outcome_option.innerHTML = outcome.outcome.display_name;
        outcome_select.append(outcome_option);
    });

    // Add selection handler for outcome selection
    outcome_select.addEventListener("change", e => {
        let outcome_id = e.target.value.split("_")[1];
        
        if(!RUBRIC){
            createRubric(outcomes[outcome_id])
            .then(response => {
                RUBRIC = response.rubric;
                RUBRIC_ASSOCIATION_ID = response.rubric_association.id
            })
            .then(addOutcomeColumn(outcomes[outcome_id]));
        }
        else{
            addOutcomeToRubric(outcomes[outcome_id]).then(response => {
                RUBRIC = response.rubric;
                addOutcomeColumn(outcomes[outcome_id]);
                e.target.options[e.target.selectedIndex].disabled = true;
                e.target.selectedIndex = 0;
            }); 
        }
        
    });
}

function processAssignments(assignmentResponse){
    assignmentResponse.reverse();

    let select = document.getElementById("assignment_select");
    document.getElementById("loading_assignments").classList.add("hidden");    
    assignmentResponse.forEach(assignment => {
        ASSIGNMENTS[assignment.id] = assignment;
        let option = document.createElement('option');
        option.value = assignment.id;
        option.innerHTML = assignment.name
        select.append(option);
    });

    // Add existing assignment to the table.
    select.addEventListener("change", e => {
        
        document.getElementById("speedgrader_link").classList.add("hidden");
        if(e.target.value == "new"){
            document.getElementById("new_assignment").classList.remove("hidden");
            document.getElementById("grade_table").querySelectorAll("student-row").forEach(row => {
                row.remove();
            });
            document.getElementById("grade_table").classList.add("hidden");
            setup();
        }
        else{
            ASSIGNMENT_ID = e.target.value;
            const url = new URL(window.location);
            url.searchParams.set("assignment_id", ASSIGNMENT_ID);
            window.history.pushState({}, '', url);
            
            let assignment = ASSIGNMENTS[ASSIGNMENT_ID];
            ASSIGNMENT_NAME = assignment.name;
            RUBRIC = null;
            if("rubric" in assignment){
                RUBRIC = assignment.rubric_settings;
                RUBRIC.criteria = assignment.rubric;
                getRubricAssociation(ASSIGNMENT_ID, assignment.rubric_settings.id).then(association_id => {
                    RUBRIC_ASSOCIATION_ID = association_id;
                });
            }
            
            assignment_students = {};
            active_outcomes = [];
            
            document.querySelectorAll(".student-row").forEach(el => {
                el.remove();
            });
            document.querySelectorAll(".outcome-header").forEach(el => {
                el.remove();
            });


            let grade_type;
            switch (assignment.grading_type) {
                case "pass_fail":
                    grade_type = "Complete/Incomplete";
                    break;
                case "percent":
                    grade_type = "Percent";
                    break;
                case "letter_grade":
                    grade_type = "Letter";
                    break;
                case "gpa_scale":
                    grade_type = "GPA Scale";
                    break;
                case "points":
                    grade_type = "Points";
                    break;
                default:
                    grade_type = "Not Graded"
                    break;
            }
            document.getElementById("grade_type").innerHTML = grade_type;

            // ADD STUDENT ROWS FROM assignment.overrides
            if("overrides" in assignment && assignment.overrides.length > 0){
                assignment.overrides.forEach(override => {
                    if("course_section_id" in override){
                        document.getElementById("student_select").querySelector(`[value=section_${override.course_section_id}]`).disabled = true;
                        sections[override.course_section_id].students.forEach(student => {
                            createStudentRow(student, true);
                            assignment_students[student.id] = override.id;
                            document.getElementById("student_select").querySelector(`[value=student_${student.id}]`).disabled = true; 
                        })
                    }
                    if("student_ids" in override){
                        override.student_ids.forEach(student_id => {
                            Object.values(sections).forEach(section => {
                                section.students.forEach(student => {
                                    if(student.id === student_id){
                                        if(!(student.id in assignment_students)){
                                            createStudentRow(student, false);
                                            assignment_students[student.id] = override.id;
                                            document.getElementById("student_select").querySelector(`[value=student_${student.id}]`).disabled = true;
                                        } 
                                    }
                                })
                            })
                        })
                    }
                })
            }
            else{
                Object.values(sections).forEach(section => {
                    section.students.forEach(student => {
                        assignment_students[student.id] = student.id;
                        createStudentRow(student, false);
                        document.getElementById("student_select").querySelector(`[value=student_${student.id}]`).disabled = true;
                    })
                });
            }

            document.getElementById("outcome_select").querySelectorAll('option').forEach(option => {
                option.disabled = false;
            });

            // ADD OUTCOME DATA
            if("rubric" in ASSIGNMENTS[ASSIGNMENT_ID]){
                ASSIGNMENTS[ASSIGNMENT_ID].rubric.forEach(criteria => {
                    addOutcomeColumn(outcomes[criteria.outcome_id]);
                    let outcome_option = document.getElementById("outcome_select").querySelector(`[value=outcome_${criteria.outcome_id}]`);
                    if(outcome_option){
                        outcome_option.disabled = true;
                    }
                });
            }
        
            // GET ASSIGNMENT SUBMISSIONS
            loadSubmissions(ASSIGNMENT_ID).then(_ => {
                document.getElementById("new_assignment").classList.add("hidden");
                document.getElementById("speedgrader_link").href = `https://avenues.instructure.com/courses/${COURSE_ID}/gradebook/speed_grader?assignment_id=${ASSIGNMENT_ID}`
                document.getElementById("speedgrader_link").classList.remove("hidden");
                document.getElementById("grade_table").classList.remove("hidden");
            });
        }
        

        
    });

    if(ASSIGNMENT_ID){
        select.value = ASSIGNMENT_ID;
        select.dispatchEvent(new Event("change"));
    }
}

async function getRubricAssociation(assignemnt_id, rubric_id){
    const rubric = await fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubrics/${rubric_id}?include[]=assignment_associations`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => {
        if(!response.ok){
            alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
            return;
        }
        return response.json()
    });

    let association_id;
    rubric.associations.some(association => {
        if(association.association_id == assignemnt_id){
            association_id = association.id;
            return true;
        }
    });
    return association_id;

}

function refreshGradeTable(){
    document.getElementById("grade_table").innerHTML = `
        <tr>
            <th id="section_select_td">
                <label for="section_select">Show </label>
                <select id="section_select">
                    <option value="all">All sections</option>
                    <hr/>

                </select>
            </th>
            <th id="grade_header">Assignment Grade<br/><span class="not-bold">(<span id="grade_type"></span>)</span></th>
            <th id="add_outcome">
                <label for="outcome_select">Add outcome </label>
                <select id="outcome_select">
                    <option value=""></option>
                </select>
            </th>
        </tr>
        <tr id="new_student_row">
            <td id="new_student_cell">
                <label for="student_select">Add student </label>
                <select id="student_select">
                    <option value=""></option>
                    <optgroup id="section_optgroup" label="Sections"></optgroup>
                    <hr />
                </select>
            </td>
        </tr>
    `

    let grade_header = document.getElementById("grade_header");
    grade_header.appendChild(newCommentToggler(grade_header, ".submission-comment-div"));
}

async function loadSubmissions(assignment_id){
    return paginatedFetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${assignment_id}/submissions?per_page=100&include[]=submission_comments&include[]=rubric_assessment`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        params: new URLSearchParams({ include: ['students'] })
    })
    .then(submissions => {
         
        // ADD ASSIGNMENT GRADE DATA
        document.getElementById("grade_table").classList.remove("hidden");
        
        submissions.forEach(submission => {
            // There is a weird case where Test Student is not in any section but can have a submissions
            if(!document.getElementById(`grade_${submission.user_id}`)){
                return
            }
                
            // SUBMISSION GRADE
            if(submission.excused){
                document.getElementById(`grade_${submission.user_id}`).remove();
                let span = document.createElement("span");
                span.innerHTML = "excused";
                span.classList.add("excused");
                span.title = "Use Gradebook to edit."
                document.getElementById(`row_${submission.user_id}`).querySelector(".submission-grade-cell").prepend(span);
            }
            else{
                switch (ASSIGNMENTS[ASSIGNMENT_ID].grading_type) { 
                    case "pass_fail":
                        // if(submission.entered_grade == "complete" || submission.entered_grade == "pass"){
                        //     document.getElementById(`grade_${submission.user_id}`).checked = true;
                        // }
                        if(submission.entered_grade == "complete" || submission.entered_grade == "pass"){
                            document.getElementById(`grade_${submission.user_id}`).dataset.value = "complete";
                            document.getElementById(`grade_${submission.user_id}`).innerHTML = check_icon;
                        }
                        else if(submission.entered_grade == "incomplete" || submission.entered_grade == "fail"){
                            document.getElementById(`grade_${submission.user_id}`).dataset.value = "incomplete";
                            document.getElementById(`grade_${submission.user_id}`).innerHTML = x_icon;
                        }
                        else {
                            document.getElementById(`grade_${submission.user_id}`).dataset.value = "";
                            document.getElementById(`grade_${submission.user_id}`).innerHTML = dash_icon;
                        }
                        break;
                    case "not_graded":
                        break;
                    case "letter_grade" ||  "gpa_scale" || "points":
                        document.getElementById(`grade_${submission.user_id}`).value = submission.entered_grade;
                        break;
                }
            }
            
            // SUBMISSION COMMENT
            if(submission.submission_comments.length > 0){
                submission.submission_comments.forEach(comment => {
                    let date = comment.edited_at ? new Date(comment.edited_at) : new Date(comment.created_at);
                    let date_string = date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
                    let comment_div = document.createElement("div");
                    comment_div.classList.add("comment-div");
                    comment_div.innerHTML = `<p>${comment.comment}</p><p class="comment-signature">${comment.author_name}, ${date_string}</p>`
                    document.getElementById(`row_${submission.user_id}`).querySelector(".comment-textarea").before(comment_div);
                });
                document.getElementById(`row_${submission.user_id}`).querySelector(".submission-comment-icon").innerHTML = comment_icon_filled;
            }
            

            // RUBRIC POINTS AND COMMENTS
            if(ASSIGNMENTS[assignment_id].rubric){
                ASSIGNMENTS[assignment_id].rubric.forEach(criterion => {
                    if(submission.rubric_assessment && criterion.id in submission.rubric_assessment){
                        let grade_cell = document.getElementById(`${submission.user_id}_${criterion.outcome_id}`)
                        if(submission.rubric_assessment[criterion.id].points){
                            grade_cell.querySelector(".points").value = submission.rubric_assessment[criterion.id].points;
                        }
                        if(submission.rubric_assessment[criterion.id].comments && submission.rubric_assessment[criterion.id].comments.trim != ""){
                            grade_cell.querySelector(".comment-textarea").value = submission.rubric_assessment[criterion.id].comments;
                            grade_cell.querySelector(".comment-icon").innerHTML = comment_icon_filled;
                        }
                        else{
                            grade_cell.querySelector(".comment-icon").innerHTML = comment_icon_unfilled;
                        }
                    }
                });
            }
        })

    });

}

async function createAssignment(title, date){
    let assignment_data = {
        assignment: {
            name: title,
            grading_type: "pass_fail",
            points_possible: 0,
            only_visible_to_overrides: true,
            published: false,
            submission_types: ["on_paper"],
        }
    };
    let token = getToken("_csrf_token").then(token => {
        fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(assignment_data)
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
        .then(new_assignment => {
            ASSIGNMENT_ID = new_assignment.id;
            ASSIGNMENTS[ASSIGNMENT_ID] = new_assignment;
            ASSIGNMENT_NAME = new_assignment.name;
            DUE_AT = date;
            document.getElementById("create_assignment").classList.add("hidden");
            document.getElementById("assignment_buttons").classList.remove("hidden");
            document.getElementById("grade_type").innerHTML = "Complete/Incomplete";
            document.getElementById("grade_table").classList.remove("hidden");
            
            // PUBLISH UNPUBLISH BUTTONS
            document.getElementById("publish").addEventListener("click", e=> {  
                e.preventDefault();
                document.getElementById("publish-unclicked").classList.add("hidden");
                document.getElementById("publish-clicked").classList.remove("hidden");
                publishAssignment(true).then(_ => {
                    document.getElementById("publish").classList.add("hidden");
                    document.getElementById("unpublish").classList.remove("hidden");
                    document.getElementById("publish-unclicked").classList.remove("hidden");
                    document.getElementById("publish-clicked").classList.add("hidden");
                    
                    document.getElementById("unpublish").addEventListener("mouseenter", e=> {  
                        console.log("here");
                        document.getElementById("unpublish-nohover").classList.add("hidden");
                        document.getElementById("unpublish-hover").classList.remove("hidden");
                    });
                    
                    document.getElementById("unpublish").addEventListener("mouseleave", e=> {  
                        console.log("here");
                        document.getElementById("unpublish-nohover").classList.remove("hidden");
                        document.getElementById("unpublish-hover").classList.add("hidden");
                    });

                    document.querySelectorAll(".grade-input").forEach(e => {
                        e.disabled = false;
                        e.removeAttribute("title");
                    });
                    document.querySelectorAll(".submission-comment-icon").forEach(e => {
                        e.classList.remove("hidden");
                    });
                    
                });
                
            });
            
            document.getElementById("unpublish").addEventListener("click", e=> {  
                e.preventDefault();
                document.getElementById("unpublish-clicked").classList.remove("hidden");
                document.getElementById("unpublish-hover").classList.add("hidden");
                document.getElementById("unpublish-nohover").classList.add("hidden");
                publishAssignment(false).then(_ => {
                    document.getElementById("unpublish").classList.add("hidden");
                    document.getElementById("publish").classList.remove("hidden");
                    document.getElementById("unpublish-hover").classList.remove("hidden");
                    document.getElementById("unpublish-nohover").classList.remove("hidden");
                    document.getElementById("unpublish-clicked").classList.add("hidden");  
                    document.querySelectorAll(".grade-input").forEach(e => {
                        e.disabled = true;
                        e.title = "Assignment must be published to be graded."
                    });
                    document.querySelectorAll(".submission-comment-icon").forEach(e => {
                        e.classList.add("hidden");
                    });
                });
            });

            // DELETE BUTTON
            document.getElementById("delete_assignment").addEventListener("click", e=> {  
                e.preventDefault();
                document.getElementById("delete-unclicked").classList.add("hidden");
                document.getElementById("delete-clicked").classList.remove("hidden");
                if (window.confirm("Are you sure you want to delete this assignment?  All assignment data will be lost.")) {
                    deleteAssignment();
                }
            });
        });
    });
    
}
            
async function publishAssignment(publish_state){
    let assignment_data = {
        assignment: {
            published: publish_state,
        }
    };
    let token = getToken("_csrf_token").then(token => {
        fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(assignment_data)
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            ASSIGNMENTS[ASSIGNMENT_ID].published = publish_state;
            return response.json()
        })
    });
}

async function deleteAssignment() {
    let token = getToken("_csrf_token").then(token => {
        return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
        .then(() => {
            setup();
        })
    });
}

function addOutcomeColumn(outcome){
    active_outcomes.push(outcome.id);
    let outcome_header = document.createElement("th");
    outcome_header.classList.add("outcome-header");
    outcome_header.innerHTML = outcome.display_name;
    outcome_header.appendChild(newCommentToggler(outcome_header, `[id$="_${outcome.id}"] .rubric-comment-div`));
    document.getElementById("add_outcome").before(outcome_header);    

    Object.entries(assignment_students).forEach(([student_id, override]) => {
        let grade_cell = createGradeCell(student_id, outcome.id);
        let student_row = document.getElementById(`row_${student_id}`);
        student_row.append(grade_cell);
    })
}

function newCommentToggler(parent, query){
    let toggle_comment = document.createElement("span");
    toggle_comment.classList.add("hover-icon");
    toggle_comment.innerHTML = comment_icon_unfilled;
    toggle_comment.title = "Toggle comments";
    toggle_comment.hidden = true;
    toggle_comment.dataset.show = "no";

    parent.addEventListener("mouseover", event => {
        toggle_comment.hidden = false;
    });
    parent.addEventListener("mouseout", event => {
        toggle_comment.hidden = true;
    });

    toggle_comment.addEventListener("click", e => {
        let show_comments = toggle_comment.dataset.show;
        if(show_comments == "yes"){
            show_comments = "no";
            toggle_comment.innerHTML = comment_icon_unfilled;
        }
        else{
            show_comments = "yes";
            toggle_comment.innerHTML = comment_icon_filled;
        }
        toggle_comment.dataset.show = show_comments;
        document.querySelectorAll(query).forEach(e => {
            if(show_comments == "yes"){
                e.classList.remove("hidden");
                let comment_textarea = e.querySelector("textarea")
                comment_textarea.style.height = (comment_textarea.scrollHeight)+"px";
            }
            else{
                e.classList.add("hidden");
            }
        });
    });
    return toggle_comment;
}

function createStudentRow(student, section_override){
    
    let student_row = document.createElement('tr');
    student_row.id = `row_${student.id}`;
    student_row.classList.add( "student-row");
    document.getElementById("new_student_row").before(student_row);
    
    let student_cell = document.createElement('td');
    student_cell.id = `cell_${student.id}`;
    student_cell.classList.add( "student-cell");
    student_cell.innerText = student.name;
    student_row.append(student_cell);
    
    if(!section_override){
        let remove_icon = document.createElement("span");
        remove_icon.innerHTML = x_icon;
        remove_icon.classList.add("hover-icon");
        remove_icon.title = "Remove student";
        remove_icon.hidden = true;
        student_cell.append(remove_icon);
        remove_icon.addEventListener("click", e => {
            removeStudent(student.id, student.name)
        });
        student_cell.addEventListener("mouseover", event => {
            remove_icon.hidden = false;
        });
        student_cell.addEventListener("mouseout", event => {
            remove_icon.hidden = true;
        });
    }
    


    // SUBMISSION GRADE CELL
    let assignment_grade_cell = document.createElement("td");
    assignment_grade_cell.classList.add("submission-grade-cell")
    student_row.append(assignment_grade_cell);
    let grade_input;
    switch (ASSIGNMENTS[ASSIGNMENT_ID].grading_type) { 
        case "pass_fail":
            grade_input = document.createElement("span");
            grade_input.id = `grade_${student.id}`;
            grade_input.classList.add("grade-input");
            grade_input.innerHTML = dash_icon;
            grade_input.dataset.value = null;
            grade_input.addEventListener("click", function(e){
                let grade;
                if(grade_input.dataset.value == ""){
                    grade = "complete";
                    grade_input.innerHTML = check_icon;
                }
                else if (grade_input.dataset.value == "complete"){
                    grade = "incomplete";
                    grade_input.dataset.value = "incomplete";
                }
                else {
                    grade_input.innerHTML = dash_icon;
                    grade = "";
                }
                updateSubmission(student.id, grade, false).then(response => {
                    if(response.grade == null){
                        grade_input.innerHTML = dash_icon;
                        grade_input.dataset.value = "";
                        return;
                    }
                    switch(response.grade){
                        case "complete" || "pass":
                            grade_input.innerHTML = check_icon;
                            grade_input.dataset.value = "complete";
                            return;
                        case "incomplete" || "fail":
                            grade_input.innerHTML = x_icon;
                            grade_input.dataset.value = "incomplete";
                            return;
                        case "":
                            grade_input.innerHTML = dash_icon;
                            grade_input.dataset.value = "";
                            return;
                    }
                })
            });

            break;
        case "not_graded":
            grade_input = document.createElement("span");
            break;
        case "letter_grade" ||  "gpa_scale" || "points":
            grade_input = document.createElement("input");
            grade_input.type = "text";
            grade_input.id = `grade_${student.id}`;
            grade_input.classList.add("grade-input");
            grade_input.addEventListener("input", e => {
                e.target.classList.add("unsaved");
            });
            grade_input.addEventListener("change", e => {
                let pointsPossible = ASSIGNMENTS[ASSIGNMENT_ID].points_possible;
                if(ASSIGNMENTS[ASSIGNMENT_ID].grading_type != "letter_grade"){
                    if(isNaN(e.target.value) || e.target.value < 0 || e.target.value > pointsPossible){
                        alert(`You've entered a grade in the incorrect format.  Make sure all grades are numbers between 0 and ${pointsPossible}`);
                    }
                    else{
                        updateSubmission(student.id, e.target.value, false);
                    }
                }
                else{
                    updateSubmission(student.id, e.target.value, false);
                }
            });
            break;
    }
    assignment_grade_cell.append(grade_input);
    


    // Add submission comment box
    let comment_icon = document.createElement("span");
    comment_icon.innerHTML = comment_icon_unfilled
    comment_icon.classList.add("comment-icon");
    comment_icon.classList.add("submission-comment-icon");
    assignment_grade_cell.append(comment_icon);

    let comment_div = document.createElement("div");
    comment_div.classList.add("submission-comment-div");
    comment_div.classList.add("hidden");
    assignment_grade_cell.append(comment_div);
    let comment_textarea = document.createElement("textarea");
    comment_textarea.placeholder = "New comment..."
    comment_textarea.classList.add("comment-textarea");
    comment_div.append(comment_textarea);
    comment_textarea.addEventListener("keyup", e => {
        e.target.style.height = "1px";
        e.target.style.height = (e.target.scrollHeight)+"px";
    });

    comment_icon.addEventListener("click", e => {
        comment_div.classList.toggle("hidden");
        comment_textarea.focus();
        comment_textarea.selectionStart = e.value ? e.value.length : 0;
    });
    
    comment_textarea.addEventListener("input", e => {
        e.target.classList.add("unsaved");
    });
    comment_textarea.addEventListener("change", e => {
        let row = e.target.closest(".student-row");
        updateSubmission(student.id, false, e.target.value).then(submission => {
            e.target.classList.remove("unsaved");
            if(submission.submission_comments.length > 0){
                comment_icon.innerHTML = comment_icon_filled;
                // TODO Move the comment out of the box, close the box, and add the comment to the comment thread
            }
            else{
                comment_icon.innerHTML = comment_icon_unfilled;
            }
        });
    });

    // TODO DISABLE BUTTON FOR COMPLETE/INCOMPLETE GRADES 
    if(!ASSIGNMENTS[ASSIGNMENT_ID].published){
        grade_input.disabled = true;
        grade_input.removeEventListener("click", {});
        grade_input.title = "Assignment must be published to be graded."
        comment_icon.classList.add("hidden");
        
    }

    // Add outcome columns
    active_outcomes.forEach(outcome_id => {
        let outcome_grade_cell = createGradeCell(student.id, outcome_id); 
        student_row.append(outcome_grade_cell);
    });

    return student_row;

}

async function updateSubmission(student_id, grade, comment){
    
    return getToken("_csrf_token").then(token => {
        if(grade === false && comment == false){
            return null;
        }
        let submission_data = new URLSearchParams();
        if(grade !== false){
            submission_data.append("submission[posted_grade]", grade);
        }
        if(comment !== false){
            submission_data.append("comment[text_comment]", comment);
        }
        return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/submissions/${student_id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json"
            },
            body: submission_data
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
        .catch(error => console.error('Error updating rubric assessment:', error));
    });
}

function createGradeCell(student_id, outcome_id){
    let grade_cell = document.createElement("td");
    grade_cell.id = `${student_id}_${outcome_id}`;
    grade_cell.classList.add("grade-cell");
    

    let grade_input = document.createElement("input");
    grade_input.type = "text";
    grade_input.classList.add("points");
    grade_input.dataset.pointsPossible = outcomes[outcome_id].points_possible;

    grade_input.addEventListener("input", e => {
        e.target.classList.add("unsaved");
    });
    grade_input.addEventListener("change", e => {
        let row = e.target.closest(".student-row");
        let value = e.target.value;
        let pointsPossible = e.target.dataset.pointsPossible;
        if(isNaN(value) || value < 0 || value > pointsPossible){
            alert(`You've entered a grade in the incorrect format.  Make sure all grades are numbers between 0 and ${pointsPossible}`);
        }
        else{
            updateRubricAssessment(row).then(rubric_assessment => {
                rubric_assessments[student_id] = rubric_assessment.id;
                e.target.classList.remove("unsaved");
            });
        }
    });

    grade_cell.append(grade_input);

    let comment_icon = document.createElement("span");
    comment_icon.innerHTML = comment_icon_unfilled
    comment_icon.classList.add("comment-icon");
    grade_cell.append(comment_icon);

    let comment_div = document.createElement("div");
    comment_div.classList.add("rubric-comment-div");
    comment_div.classList.add("hidden");
    grade_cell.appendChild(comment_div);

    let comment_textarea = document.createElement("textarea");
    comment_textarea.classList.add("comment-textarea");
    comment_textarea.placeholder = "Add comment..."
    comment_div.append(comment_textarea);
    comment_textarea.addEventListener("keyup", e => {
        e.target.style.height = "1px";
        e.target.style.height = (e.target.scrollHeight)+"px";
    })

    comment_icon.addEventListener("click", e => {
        comment_div.classList.toggle("hidden");
        comment_textarea.style.height = (comment_textarea.scrollHeight)+"px";
        comment_textarea.focus();
        comment_textarea.selectionStart = comment_textarea.value.length;
        comment_textarea.selectionEnd = comment_textarea.value.length;
    });
    
    comment_textarea.addEventListener("input", e => {
        e.target.classList.add("unsaved");
    });
    comment_textarea.addEventListener("change", e => {
        let row = e.target.closest(".student-row");
        updateRubricAssessment(row).then(rubric_assessment => {
            rubric_assessments[student_id] = rubric_assessment.id;
            e.target.classList.remove("unsaved");
            if(comment_textarea.value && comment_textarea.value.trim() != ""){
                comment_icon.innerHTML = comment_icon_filled;
            }
            else{
                comment_icon.innerHTML = comment_icon_unfilled;
            }
        });
    });

    return grade_cell;
}

function updateRubricAssessment(row){
    
    return getToken("_csrf_token").then(token => {
        
        let rubric_assessment_data = new URLSearchParams();
        rubric_assessment_data.append("course_id", COURSE_ID);
        rubric_assessment_data.append("rubric_association_id", RUBRIC_ASSOCIATION_ID);
        rubric_assessment_data.append("rubric_assessment[assessment_type]", "grading");
        
        let student_id = row.id.split("_")[1];
        rubric_assessment_data.append("rubric_assessment[user_id]", student_id);
        
        row.querySelectorAll(".grade-cell").forEach(grade_cell => {
            let outcome_id = grade_cell.id.split("_")[1];
            let criterion_id;
            RUBRIC.criteria.some(c => {
                // In existing assignments the outcome_id is called "outcome_id"
                // In new asssignments the outcome_id is called "learning_outcome_id"
                if(c.learning_outcome_id == outcome_id || c.outcome_id == outcome_id){
                    criterion_id = c.id;
                    return true;
                }
            });
            if(!criterion_id){
                throw new Error("Something went wrong with adding the rubric assessment.");
            }
            let points = grade_cell.querySelector('.points').value;
            rubric_assessment_data.append(`rubric_assessment[criterion_${criterion_id}][points]`, points);
            let comment =  grade_cell.querySelector('.comment-textarea').value;
            rubric_assessment_data.append(`rubric_assessment[criterion_${criterion_id}][comments]`, comment);

        })
        

        if(!(student_id in rubric_assessments)){
            return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubric_associations/${RUBRIC_ASSOCIATION_ID}/rubric_assessments`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    "X-CSRF-Token": token,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json"
                },
                body: rubric_assessment_data
            })
            .then(response => {
                if(!response.ok){
                    alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                    return;
                }
                return response.json()
            })
            .catch(error => console.error('Error creating rubric assessment:', error));
        } else{
            rubric_assessment_data.append("id", rubric_assessments[student_id]);
            return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubric_associations/${RUBRIC_ASSOCIATION_ID}/rubric_assessments/${rubric_assessments[student_id]}`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    "X-CSRF-Token": token,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json"
                },
                body: rubric_assessment_data
            })
            .then(response => {
                if(!response.ok){
                    alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                    return;
                }
                return response.json()
            })
            .catch(error => console.error('Error updating rubric assessment:', error));
        }
    });
}

function addStudentToAssignment(student){
    let assignment_override = {
        assignment_override: {
            student_ids: [student.id],
            due_at: DUE_AT,
            title: student.name
        }
    };
    return getToken("_csrf_token").then(token => {
        return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/overrides`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(assignment_override)
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
    });
}

function removeStudent(student_id, student_name){
    if(!confirm(`Are you sure you want to remove ${student_name} and their grades from this assignment?`)){
        return false;
    }
    getToken("_csrf_token").then(token => {
        let override_id = assignment_students[student_id];
        fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/overrides/${override_id}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Accept": "application/json"
            }
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            delete assignment_students[student_id];
            document.getElementById(`row_${student_id}`).remove();
            document.getElementById("student_select").querySelector(`[value=student_${student_id}]`).disabled = false;
        })
        .catch(error => console.error('Error removing student from assignment:', error));
    });
}

function createRubric(outcome){

    return getToken("_csrf_token").then(token => {
        let rubric_data = new URLSearchParams();
        rubric_data.append("rubric[title]", `Rubric for ${ASSIGNMENT_NAME}`);
        rubric_data.append("rubric[points_possible]", outcome.points_possible);
        rubric_data.append("rubric_association[use_for_grading]", 0);
        rubric_data.append("rubric_association[hide_score_total]", 1);
        rubric_data.append("rubric_association[hide_points]", 0);
        rubric_data.append("rubric_association[hide_outcome_results]", 0);
        rubric_data.append("rubric[free_form_criterion_comments]", 1);
        rubric_data.append("rubric_association[id]", "");
        rubric_data.append("rubric_association_id", "");
        rubric_data.append("rubric[criteria][0][description]", outcome.display_name);
        rubric_data.append("rubric[criteria][0][points]", outcome.points_possible);
        rubric_data.append("rubric[criteria][0][learning_outcome_id]", outcome.id);
        rubric_data.append("rubric[criteria][0][long_description]", "");
        rubric_data.append("rubric[criteria][0][id]", "");
        rubric_data.append("rubric[criteria][0][criterion_use_range]", false);
        rubric_data.append("rubric[criteria][0][mastery_points]", outcome.mastery_points);
        outcome.ratings.forEach((rating, i) => {
            rubric_data.append(`rubric[criteria][0][ratings][${i}][description]`, outcome.ratings[i].description);
            rubric_data.append(`rubric[criteria][0][ratings][${i}][long_description]`, "");
            rubric_data.append(`rubric[criteria][0][ratings][${i}][points]`, outcome.ratings[i].points);
            rubric_data.append(`rubric[criteria][0][ratings][${i}][id]`, "blank");
        })
        rubric_data.append("title", `Rubric for ${ASSIGNMENT_NAME}`);
        rubric_data.append("points_possible", 3);
        rubric_data.append("rubric_id", "new");
        rubric_data.append("rubric_association[association_type]", "Assignment");
        rubric_data.append("rubric_association[association_id]", ASSIGNMENT_ID);
        rubric_data.append("rubric_association[purpose]", "grading");
        rubric_data.append("skip_updating_points_possible", false);
        rubric_data.append("_method", "POST");
        rubric_data.append("authenticity_token", token);
        
        return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubrics`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json"
            },
            body: rubric_data
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
        .catch(error => console.error('Error creating rubric:', error));
    });
    

}

function addOutcomeToRubric(outcome){

    return getToken("_csrf_token").then(token => {
        let rubric_data = new URLSearchParams();
        
        // Add existing criteria
        RUBRIC.criteria.forEach((criteria, i) => {
            rubric_data.append(`rubric[criteria][${i}][description]`, criteria.description);
            rubric_data.append(`rubric[criteria][${i}][points]`, criteria.points);
            let learning_outcome_id;
            if(criteria.learning_outcome_id){
                learning_outcome_id = criteria.learning_outcome_id
            }
            if(criteria.outcome_id){
                learning_outcome_id = criteria.outcome_id
            }
            rubric_data.append(`rubric[criteria][${i}][learning_outcome_id]`, learning_outcome_id);
            rubric_data.append(`rubric[criteria][${i}][long_description]`, criteria.long_description);
            rubric_data.append(`rubric[criteria][${i}][mastery_points]`, outcome.mastery_points);
            criteria.ratings.forEach((rating, j) => {
                rubric_data.append(`rubric[criteria][${i}][ratings][${j}][description]`, outcome.ratings[i].description);
                rubric_data.append(`rubric[criteria][${i}][ratings][${j}][long_description]`, "");
                rubric_data.append(`rubric[criteria][${i}][ratings][${j}][points]`, outcome.ratings[i].points);
                rubric_data.append(`rubric[criteria][${i}][ratings][${j}][id]`, "blank");
            });
        });

        // Add new criterion
        let new_index = RUBRIC.criteria.length;
        rubric_data.append(`rubric[criteria][${new_index}][description]`, outcome.display_name);
        rubric_data.append(`rubric[criteria][${new_index}][points]`, outcome.points_possible);
        rubric_data.append(`rubric[criteria][${new_index}][learning_outcome_id]`, outcome.id);
        rubric_data.append(`rubric[criteria][${new_index}][long_description]`, outcome.description);
        rubric_data.append(`rubric[criteria][${new_index}][mastery_points]`, outcome.mastery_points);
        outcome.ratings.forEach((rating, j) => {
            rubric_data.append(`rubric[criteria][${new_index}][ratings][${j}][description]`, rating.description);
            rubric_data.append(`rubric[criteria][${new_index}][ratings][${j}][long_description]`, "");
            rubric_data.append(`rubric[criteria][${new_index}][ratings][${j}][points]`, rating.points);
            rubric_data.append(`rubric[criteria][${new_index}][ratings][${j}][id]`, "blank");
        });
        rubric_data.append("_method", "PUT");
        rubric_data.append("authenticity_token", token);

        return fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubrics/${RUBRIC.id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                "X-CSRF-Token": token,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json"
            },
            body: rubric_data
        })
        .then(response => {
            if(!response.ok){
                alert("Something went wrong with your connection to Canvas.\n\nClose this window, refresh Canvas, and try again.")
                return;
            }
            return response.json()
        })
        .catch(error => console.error('Error adding outcome to rubric:', error));
    });
}

// Fetch that handles pagination
// Returns data directly, no need to run response.json()
function paginatedFetch(url, params) {
    return fetch(url, params)
        .then(response => response.json()
        .then(data => ({ response, data })))
        .then(({ response, data }) => {
            const linkHeader = response.headers.get("link");
            const match = /<([^>]+)>; rel="next"/.exec(linkHeader);

            if (match) {
                const nextPage = match[1];
                return paginatedFetch(nextPage, params).then(nextData => data.concat(nextData));
            }

            return data;
        })
        .catch(err => {
            console.error(err);
            return [];
        });
}

function getToken(name){
	let cookie_details = {
        domain: BASE_URL,
    }
    return chrome.cookies.getAll(cookie_details).then(cookies => {
        let name_cookies = cookies.filter(c => c.name == name);
        if(name_cookies.length == 0){
            return null;
        }
        return decodeURIComponent(name_cookies[0].value);
    })
    
}

function toIsoString(date) {
    var tzo = -date.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num) {
            return (num < 10 ? '0' : '') + num;
        };
  
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        dif + pad(Math.floor(Math.abs(tzo) / 60)) +
        ':' + pad(Math.abs(tzo) % 60);
}

function saveFocused(){
    const focused = document.activeElement;
    if(focused.classList.contains("points") || focused.classList.contains("comment-textarea")){
        const row = focused.closest(".student-row");
        updateRubricAssessment(row);
    }
    return null;
 }
