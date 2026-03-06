var BASE_URL = window.location.hostname;
var COURSE_ID = window.location.pathname.split('/')[2];
var INDIVIDUAL_ASSIGNMENT_GROUP_ID = false;
var OUTCOME_GRID;
var SECTIONS = [];
var sidebar_width = 83;

window.addEventListener('load', function () {
    modifyDOM();
});

window.addEventListener('hashchange', function (e) {
    if (window.location.hash.indexOf('#tab-outcome') > -1) {
        modifyDOM();
    }
});

function modifyDOM() {
    
	var waitInterval = setInterval(function () {
        // Check if the extension version of the gradebook is already loaded
        if (document.querySelector('.outcome-table')) {
            clearInterval(waitInterval);
        } else if (document.querySelector('.outcome-gradebook > [class*=slickgrid_]')) {
            // Clear existing elements and styles
            var changeGradebookLinkHolder = document.getElementById('change_gradebook_version_link_holder');
            var outcomeGradebookPaginator = document.getElementById('outcome-gradebook-paginator');
            var outcomeGradebookWrapper = document.querySelector('.outcome-gradebook-wrapper');
            var outcomeGradebook = document.querySelector('.outcome-gradebook');

            if (changeGradebookLinkHolder) changeGradebookLinkHolder.remove();
            if (outcomeGradebookPaginator) outcomeGradebookPaginator.remove();
            if (outcomeGradebookWrapper) outcomeGradebookWrapper.style.paddingTop = '0';

            // Clear and reset styles
            outcomeGradebook.innerHTML = '';
            outcomeGradebook.style.height = 'auto';
            outcomeGradebook.style.paddingLeft = '0';

			let canvas_sidebar = document.querySelector('.ic-app-header__main-navigation');
			sidebar_width = canvas_sidebar.getBoundingClientRect().width;

            

            // var wrapper = document.createElement('div');
            // wrapper.className = 'outcome-gradebook-wrapper';
            // wrapper.style = "opacity: 1; overflow-x: hidden; outline: 0; position: relative; display: block;";
            // outcomeGradebook.appendChild(wrapper);

            // Detect and handle section select box changes
            var sectionSelectBox = document.querySelector('*[data-component="SectionFilter"] input');
            if (sectionSelectBox) {
                // Using MutationObserver to detect changes in the input value
                var observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                            select_section(sectionSelectBox.value);
                        }
                    });
                });
                observer.observe(sectionSelectBox, { attributes: true });

                // Initial select
                select_section(sectionSelectBox.value);
            } else {
                // Default to all sections if no select box is present
                select_section(0);
            }

            clearInterval(waitInterval);

			// Append new elements
            var sidebar = document.createElement('div');
            sidebar.className = 'outcome-gradebook-sidebar';
            sidebar.hidden = true;
            sidebar.innerHTML = `
                <div class="outcome-gradebook-sidebar-header"></div>
                <div class="outcome-gradebook-sidebar-content"></div>
            `;
            document.getElementById("main").appendChild(sidebar);
        }
    }, 100);
}


function select_section(section) {
    document.querySelectorAll('.outcome-student-row').forEach(function (row) {
        if (section === 0 || row.dataset.section === section.toString()) {
            row.style.display = 'block';
        } else {
            row.style.display = 'none';
        }
    });

    // Load students, sections, outcomes, and outcome rollups
    let sections = {};
    let sections_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/sections?per_page=100`;

    fetch(sections_url, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        data.forEach(section => {
            sections[section.id] = section.name;
        });

        var rollup_data = null;
        let rollups_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/outcome_rollups?per_page=100&include[]=users&include[]=outcomes`;
        getOutcomeRollups(rollups_url, rollup_data);
    })
    .catch(error => {
        console.log('Error fetching sections:', error);
    });

    function getOutcomeRollups(url, rollup_data) {
        fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (!rollup_data) {
                rollup_data = data;
            } else {
                rollup_data.rollups = rollup_data.rollups.concat(data.rollups);
                rollup_data.linked.users = rollup_data.linked.users.concat(data.linked.users);
            }

            if (data.meta && data.meta.pagination && data.meta.pagination.next) {
                console.log('Getting more rollups...');
                getOutcomeRollups(data.meta.pagination.next, rollup_data);
            } else {
                deduplicateUsers(rollup_data);
                build_grid(rollup_data, sections, section, wrapper);
            }
        })
        .catch(error => {
            console.log('Error fetching rollups:', error);
        });
    }

    function deduplicateUsers(data) {
        let uniqueUserIds = new Set();
        let newUsersList = data.linked.users.filter(user => {
            if (!uniqueUserIds.has(user.id)) {
                uniqueUserIds.add(user.id);
                return true;
            }
            return false;
        });

        data.linked.users = newUsersList;

        let uniqueRollups = new Set();
        let newRollupsList = data.rollups.filter(rollup => {
            if (!uniqueRollups.has(rollup.links.user)) {
                uniqueRollups.add(rollup.links.user);
                return true;
            }
            return false;
        });

        data.rollups = newRollupsList;
    }
}

function build_grid(rollup_data, sections, section, wrapper) {
    var student_data = {};
    var outcome_data = {};
    var temp_sorted_students = [];
    var sorted_students = [];
    var sorted_outcomes = [];

    rollup_data.linked.outcomes.forEach((outcome) => {
        outcome_data[outcome.id] = outcome;
        outcome_data[outcome.id].cutoffs = {
            'near-mastery': outcome.mastery_points / 2,
            'mastery': outcome.mastery_points,
            'exceeds': outcome.mastery_points + ((outcome.points_possible - outcome.mastery_points) / 2)
        };
        sorted_outcomes.push([outcome.title, outcome.id]);
    });

    sorted_outcomes.sort((a, b) => a[0].localeCompare(b[0]));

    rollup_data.linked.users.forEach((student) => {
        student_data[student.id] = student;
        student_data[student.id].outcomes = {};
        Object.keys(outcome_data).forEach((outcome_id) => {
            student_data[student.id].outcomes[outcome_id] = {
                id: student.id + '_' + outcome_id,
                outcome_id: outcome_id,
                score: "-",
                most_recent: false
            };
        });
        temp_sorted_students.push({ id: student.id, sortable_name: student.sortable_name });
    });

    temp_sorted_students.sort((a, b) => a.sortable_name.localeCompare(b.sortable_name));
    temp_sorted_students.forEach((student) => sorted_students.push(student.id));

    rollup_data.rollups.forEach((rollup) => {
        student_data[rollup.links.user].section = sections[rollup.links.section];
        rollup.scores.forEach((score) => {
            student_data[rollup.links.user].outcomes[score.links.outcome]['score'] = score.score;
            student_data[rollup.links.user].outcomes[score.links.outcome]['most_recent'] = score.submitted_at;
        });
    });

    // Clear existing table if present
    var existingWrapper = document.querySelector('.outcome-table-wrapper');
    if (existingWrapper) existingWrapper.remove();

    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'outcome-table-wrapper';
    var table = document.createElement('table');
    table.className = 'outcome-table';
	table.style.left = sidebar_width;
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    headerRow.className = 'outcome-table-header-row';
    var studentHeaderCell = document.createElement('th');
    studentHeaderCell.className = 'outcome-student-header-cell';
	studentHeaderCell.innerHTML = '<b>Students</b>'
    headerRow.appendChild(studentHeaderCell);
    thead.appendChild(headerRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    tbody.className = 'outcome-table-body';
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    document.getElementById("main").appendChild(tableWrapper); // Assuming 'wrapper' is a valid DOM element

    // Add outcome headers
    sorted_outcomes.forEach((outcome) => {
        var [outcomeTitle, outcomeId] = outcome;
        var headerCell = document.createElement('th');
        headerCell.className = 'outcome-result-header-cell';
        headerCell.textContent = outcome_data[outcomeId].title;
        headerCell.id = `outcome-header_${outcomeId}`;
        headerCell.dataset.outcomeId = outcomeId;

        // Popup dialog for outcome description (implementing modal functionality can be complex in plain JS)
        // var dialog = document.createElement('div');
        // dialog.className = 'outcome-description-dialog';
        // dialog.id = `dialog__${outcomeId}`;
        // dialog.title = outcome_data[outcomeId].title;
        // dialog.textContent = outcome_data[outcomeId].description;
        // headerCell.appendChild(dialog);
        headerCell.addEventListener('click', () => {
            alert(`Description for ${outcome_data[outcomeId].title}: ${outcome_data[outcomeId].description}`);
        });

        headerRow.appendChild(headerCell);
    });

    // Add student rows
	sorted_students.forEach(student_id => {
		const student = student_data[student_id];
		
		if (section === "All Sections" || student.section === section) {
			// Create a table row element
			const tr = document.createElement('tr');
			tr.classList.add('outcome-student-row');
			tr.setAttribute('data-section', student.section);
			
			// Create student cell with avatar and link
			const studentCell = `
				<td class="outcome-student-cell">
					<div class="outcome-student-cell-content">
						<a class="avatar" style="background-image: url(${student.avatar_url})">
							<span class="screenreader-only">${student.display_name}</span>
						</a>
						<a class="student-name student_context_card_trigger" 
						data-student_id="${student.id}" 
						data-course_id="${COURSE_ID}" 
						href="/courses/${COURSE_ID}/grades/${student.id}#tab-outcomes">
							${student.display_name}
						</a>
						<div class="student-section"></div>
					</div>
				</td>
			`;
			tr.innerHTML = studentCell;
			
			// Append the student row to the table body
			document.querySelector('.outcome-table-body').appendChild(tr);
			
			// Iterate over sorted outcomes
			sorted_outcomes.forEach(([outcome_name, outcome_id]) => {
				let mastery_class = 'remedial';
				const studentOutcome = student.outcomes[outcome_id];
				let score = studentOutcome.score;
				let td_html;

				// Check if score is valid
				if (score !== "-") {
					Object.entries(outcome_data[outcome_id].cutoffs).forEach(([cutoff_class, cutoff]) => {
						if (score >= cutoff) {
							mastery_class = cutoff_class;
						} else {
							return false;
						}
					});
					

					td_html = `
						<td class="outcome-result-cell" id="${student_id}__${outcome_id}">
							<div class="outcome-cell-wrapper" 
								data-student="${student_id}" 
								data-outcome="${outcome_id}" 
								data-rollup="${score}">
								<span class="outcome-score">${score} /${outcome_data[outcome_id].mastery_points}</span>
								<span class="outcome-result ${mastery_class}"></span>
							</div>
						</td>
					`;
				} else {
					td_html = `
						<td class="outcome-result-cell" id="${student_id}__${outcome_id}">
							<div class="outcome-cell-wrapper" 
								data-student="${student_id}" 
								data-outcome="${outcome_id}" 
								data-rollup="none">
								<span class="outcome-score">-</span> /${outcome_data[outcome_id].mastery_points}
								<span class="outcome-result no-mastery-data"></span>
							</div>
						</td>
					`;
				}
				
				// Append the outcome result cell to the row
				tr.insertAdjacentHTML('beforeend', td_html);

				// 


			});
		}
	});

	document.querySelectorAll(".outcome-cell-wrapper").forEach(e => {
		e.addEventListener('click', () => sidebar(e));
	})

	function sidebar(element){
		// Remove the selected class from all selected cells and add it to the clicked element's parent
		document.querySelectorAll('.outcome-result-cell.selected').forEach(el => el.classList.remove('selected'));
		element.parentElement.classList.add('selected');
	
		// Update and activate sidebar components
		document.querySelector('.outcome-gradebook-sidebar').classList.add('interactive');
		const sidebarHeader = document.querySelector('.outcome-gradebook-sidebar-header');
		sidebarHeader.innerHTML = '';
		sidebarHeader.classList.add('interactive');
	
		const sidebarContent = document.querySelector('.outcome-gradebook-sidebar-content');
		sidebarContent.innerHTML = '';
		sidebarContent.classList.add('interactive');

		document.querySelector('.outcome-gradebook-sidebar').hidden = false;
	
		// Extract data attributes from the clicked element
		const student_id = element.getAttribute('data-student');
		const outcome_id = parseInt(element.getAttribute('data-outcome'));
		const rollup = element.getAttribute('data-rollup');
		const rollup_html = element.innerHTML;
	
		let assignment_ids = [];
		let assignments = {};

		const params = {
			user_ids: [student_id],
			outcome_ids: [outcome_id],
			include: ['alignments'],
			per_page: 100
		}
		
		const queryString = new URLSearchParams();

		for (const key in params) {
			if (Array.isArray(params[key])) {
				params[key].forEach(value => queryString.append(key+"[]", value));
			} else {
				queryString.append(key, params[key]);
			}
		}

		const url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/outcome_results?`+queryString;
	
		getOutcomeResults(url);
	
		function getOutcomeResults(url) {
			fetch(url, {
				headers: { 'Content-Type': 'application/json' },
				
			})
			.then(response => {
				if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
				const nextUrl = getNextLink(response.headers.get('Link'), 'next');
				return response.json().then(data => ({ data, nextUrl }));
			})
			.then(({ data, nextUrl }) => {
				data.linked.alignments.forEach(alignment => {
					const id = alignment.id.split('_')[1];
					assignment_ids.push(id);
					assignments[id] = {
						id,
						student_id,
						name: alignment.name,
						url: alignment.html_url,
						comment: ''
					};
				});
	
				data.outcome_results.forEach(result => {
					const id = result.links.alignment.split('_')[1];
					assignments[id]['possible'] = result.possible;
				});
	
				if (nextUrl) {
					console.log('Fetching more results...');
					getOutcomeResults(nextUrl);
				} else {
					buildSidebar();
				}
			})
			.catch(error => console.error('Error fetching outcome results:', error));
		}
	
		function buildSidebar() {
			const sidebarHeaderHTML = `
				<div class="sidebar-header">
					<div class="sidebar-close-icon">×</div>
					<h1 class="sidebar-name">${student_data[student_id].display_name}</h1>
					<div style="display:table">
						<div style="display:table-cell; width:110px;">
							<div class="outcome-cell-wrapper"><h1>${rollup_html}</h1></div>
						</div>
						<div style="display:table-cell">
							<h1 class="sidebar-">${outcome_data[outcome_id].title} 
								<span><a href="#" class="outcome-description-link">more</a></span>
							</h1>
						</div>
					</div>
				</div>
			`;
	
			sidebarHeader.innerHTML = sidebarHeaderHTML;
	
			document.querySelector('.sidebar-close-icon').addEventListener('click', () => {
				document.querySelector('.outcome-gradebook-sidebar').hidden = true;
				sidebarHeader.innerHTML = '';
				sidebarHeader.classList.remove('interactive');
				sidebarContent.innerHTML = '';
				sidebarContent.classList.remove('interactive');
			});
	
			document.querySelector('.outcome-description-link').addEventListener('click', e => {
				e.preventDefault();
				document.getElementById(`dialog__${outcome_id}`).open();
			});
	
			// Rest of sidebar initialization
			buildNewAssessmentToggle();
			buildSidebarForm();
			buildSidebarList();
		}
	
		function buildNewAssessmentToggle() {
			const navHTML = `
				<nav>
					<ul class="nav nav-pills">
						<li id="new-assessment-button" class="active">
							<a href="#">
								<span id="new-assessment-label">New Assessment</span>
								<span id="hide-form-label" hidden>Hide Form</span>
							</a>
						</li>
					</ul>
				</nav>
			`;
			sidebarHeader.insertAdjacentHTML('beforeend', navHTML);
	
			document.getElementById('new-assessment-button').addEventListener('click', e => {
				e.preventDefault();
				const form = document.getElementById('new-assessment-form');
				form.hidden = !form.hidden;
	
				document.getElementById('new-assessment-label').toggleAttribute('hidden');
				document.getElementById('hide-form-label').toggleAttribute('hidden');
			});
		}
	
		function buildSidebarForm() {
			const formHTML = `
				<div id="new-assessment-form" hidden>
						<div id="new-assignment-overlay" hidden></div>
						<div id="new-assignment-spinner" class="spinner" role="progressbar" hidden>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-0-12 1s linear infinite;">
								<div style="transform: rotate(0deg) translate(10px, 0px); border-radius: 2px;"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-1-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(30deg)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-2-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(60deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-3-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(90deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-4-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(120deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-5-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(150deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-6-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(180deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-7-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(210deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-8-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(240deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-9-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(270deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-10-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(300deg) translate(10px, 0px)"></div>
							</div>
							<div class="spinner-image-wrapper" style="animation: opacity-100-25-11-12 1s linear infinite;">
								<div class="spinner-image" style="transform: rotate(330deg) translate(10px, 0px)"></div>
							</div>
						</div>
				
						<div class="form-group">
						    <label for="assessment-title">Title </label>
							<input type="text" class="form-control" id="assessment-title"><br/>
							<label for="assessment-date">Date </label>
							<input type="date" id="assessment-date" >
						</div>
						<div id="rubric" class="form-group" style="display:table" data-rubric-association-id="" data-criterion-id=""></div>

						<div class="form-group">
							<label for="assessment-comment">Comment </label>
							<textarea class="form-control" id="assessment-comment"></textarea>
						</div>
						<button type="submit" class="btn btn-default" id="assessment-submit" style="display:table-cell; text-align:right">Submit</button>
					</form>
				</div>
			`;
	
			sidebarHeader.insertAdjacentHTML('beforeend', formHTML);
			
			var localDate = new Date();
  			localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
			document.getElementById('assessment-date').value = localDate.toJSON().slice(0, 10);

			// Populate rubric with ratings
			outcome_data[outcome_id].ratings.forEach(rating => {
				const rubricCell = document.createElement('div');
				rubricCell.className = 'rubric-cell rubric-selection';
				rubricCell.style.display = 'table-cell';
				rubricCell.setAttribute('data-points', rating.points);
				rubricCell.innerHTML = `
					<span class="rubric-description">${rating.description}</span><br/>
					<span class="rubric-description">${rating.points} pts</span>
				`;
				document.getElementById('rubric').appendChild(rubricCell);
			});

			// Add points input at the end
			const pointsCell = document.createElement('div');
			pointsCell.className = 'rubric-cell points-cell';
			pointsCell.style.display = 'table-cell';
			pointsCell.innerHTML = `
				<span class="rubric-description">
					<input type="text" class="form-control assessment-points" style="width:20px"> / ${outcome_data[outcome_id].mastery_points} pts
				</span>
			`;
			document.getElementById('rubric').appendChild(pointsCell);
			const assessmentPoints = pointsCell.querySelector('.assessment-points');

			// Add click event to rubric selections
			document.querySelectorAll('#rubric .rubric-selection').forEach(selection => {
				selection.addEventListener('click', function() {
					this.classList.toggle('selected');
					document.querySelectorAll('#rubric .rubric-selection').forEach(sibling => {
						if (sibling !== this) sibling.classList.remove('selected');
					});
					if (this.classList.contains('selected')) {
						assessmentPoints.value = this.getAttribute('data-points');
					} else {
						assessmentPoints.value = '';
					}
				});
			});

			// Add change event to assessment points input
			assessmentPoints.addEventListener('input', function() {
				const newPoints = this.value;
				document.querySelectorAll('.rubric-selection').forEach(selection => {
					selection.classList.remove('selected');
					if (selection.getAttribute('data-points') === newPoints) {
						selection.classList.add('selected');
					}
				});
			});
			
			document.getElementById('assessment-submit').addEventListener('click', submitAssessment);
		}
	
		function buildSidebarList() {
			// If there are assignments, build the list
			const sidebarList = document.createElement('div');
			sidebarList.className = 'sidebar-list';
			sidebarContent.appendChild(sidebarList);
	
			if (assignment_ids.length > 0) {
				const params = {
					student_ids: [student_id],
					assignment_ids: assignment_ids,
					include: ['submission_history', 'submission_comments', 'rubric_assessment', 'assignment']
				}
				const queryString = new URLSearchParams();

				for (const key in params) {
					if (Array.isArray(params[key])) {
						params[key].forEach(value => queryString.append(key+"[]", value));
					} else {
						queryString.append(key, params[key]);
					}
				}

				const submissions_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/students/submissions?per_page=100&`+queryString.toString();
				getSubmissions(submissions_url);
			} else {
				sidebarList.innerHTML = `
					<div class="assignment-row no-assessments" style="padding-top:6px">
						${student_data[student_id].display_name} does not have any assessments yet for this outcome.
					</div>
				`;
			}
		}
	
		function getSubmissions(url) {
			fetch(url, {
				headers: { 'Content-Type': 'application/json' }
			})
			.then(response => {
				// Capture response before parsing JSON
				const nextUrl = getNextLink(response.headers.get('Link'), 'next');
				return response.json().then(data => ({ data, nextUrl }));
			})
			.then(({ data, nextUrl }) => {
				data.forEach(submission => {
					assignments[submission.assignment_id].rubric = submission.assignment.rubric;
					assignments[submission.assignment_id].datetime = submission.cached_due_date;
				
					let rubric_criterion_id;
				
					// Iterate over submission.assignment.rubric
					submission.assignment.rubric.forEach(r => {
						if (r.outcome_id === outcome_id) {
							rubric_criterion_id = r.id;
						}
					});
				
					// Iterate over submission.rubric_assessment
					for (const [key, rubric_assessment] of Object.entries(submission.rubric_assessment)) {
						if (key === rubric_criterion_id) {
							if (rubric_assessment.points == null || !rubric_assessment.hasOwnProperty('points')) {
								assignments[submission.assignment_id].score = '-';
								assignments[submission.assignment_id].mastery_class = 'no-mastery-data';
							} else {
								assignments[submission.assignment_id].score = rubric_assessment.points;
				
								// Iterate over outcome_data cutoffs
								for (const [cutoff_class, cutoff] of Object.entries(outcome_data[outcome_id].cutoffs)) {
									if (rubric_assessment.points >= cutoff) {
										assignments[submission.assignment_id].mastery_class = cutoff_class;
									}
								}
							}
				
							if (!assignments[submission.assignment_id].hasOwnProperty('score')) {
								assignments[submission.assignment_id].score = '-';
								assignments[submission.assignment_id].mastery_class = 'no-mastery-data';
							}
				
							// Append comments if available
							if (rubric_assessment.comments.length > 0) {
								rubric_assessment.comments.split('\n').forEach(line => {
									assignments[submission.assignment_id].comment += `<p>${line}</p>`;
								});
							}
						}
					}
				});
				
		
				// Recursive call if there is a next URL
				if (nextUrl) {
					console.log('Getting more submissions...')
					getSubmissions(nextUrl);
				}
				else {
					let sorted_assignments = [];

					// Iterate over the assignments object and populate sorted_assignments array
					for (const [key, assignment] of Object.entries(assignments)) {
						sorted_assignments.push({ id: key, datetime: assignment.datetime });
					}

					// Sort sorted_assignments by datetime
					sorted_assignments.sort((a, b) => {
						return a.datetime > b.datetime ? 1 : a.datetime < b.datetime ? -1 : 0;
					});

					// Iterate over the sorted assignments and process them
					sorted_assignments.forEach(a => {
						const assignment = assignments[a.id];
						add_assignment(assignment, outcome_id, outcome_data[outcome_id]);
					});
				}
			})
			.catch(error => console.error('Error fetching submissions:', error));
		}
	
		function submitAssessment(e) {
			console.log('Submit clicked...');
			e.preventDefault();
			// Check values
			let submit = true;

			const assessmentTitle = document.getElementById('assessment-title');
			const assessmentPoints = document.getElementById('new-assessment-form').querySelector('.assessment-points');
			const assessmentComment = document.getElementById('assessment-comment');

			// Validate title
			if (assessmentTitle.value === '' || assessmentTitle.value.includes('[') || assessmentTitle.value.includes(']')) {
				submit = false;
				assessmentTitle.classList.add('invalid');
			} else {
				assessmentTitle.classList.remove('invalid');
			}

			// Validate points
			const pointsValue = parseFloat(assessmentPoints.value);
			if (isNaN(pointsValue) || pointsValue < 0 || pointsValue > outcome_data[outcome_id].points_possible) {
				submit = false;
				assessmentPoints.classList.add('invalid');
			} else {
				assessmentPoints.classList.remove('invalid');
			}

			if (!submit) {
				alert(`Invalid assessment input. Assessment must have a title which may not use the [ or ] characters. Assessment must have a score between 0 and ${outcome_data[outcome_id].points_possible}.`);
				return false;
			}

			assessmentTitle.classList.remove('invalid');
			assessmentPoints.classList.remove('invalid');

			// Show loading overlay
			document.getElementById('new-assignment-overlay').style.display = 'block';
			document.getElementById('new-assignment-spinner').style.display = 'block';

			// Prepare data for submission
			const name = `${assessmentTitle.value} || ${student_data[student_id].display_name} | ${outcome_data[outcome_id].display_name}`;
			const date = new Date().toISOString();
			const score = pointsValue;
			const comment = assessmentComment.value;

			const assignment_data = {
				assignment: {
					name: name,
					assignment_group_id: INDIVIDUAL_ASSIGNMENT_GROUP_ID,
					grading_type: "pass_fail",
					points_possible: 0,
					only_visible_to_overrides: true,
					published: true,
					submission_types: ["none"],
					assignment_overrides: [{
						student_ids: [student_id],
						due_at: date,
					}],
				}
			};

			// Ensure individual assignment group exists
			if (!INDIVIDUAL_ASSIGNMENT_GROUP_ID) {
				console.log('Looking for individual assignment group...');
				const assignment_groups_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignment_groups`;
				getAssignmentGroups(assignment_groups_url);
			} else {
				post_assignment(assignment_data, student_id, outcome_data[outcome_id], score, comment);
			}

			function getAssignmentGroups(url) {
				fetch(url)
					.then(response => {
						// Capture response before parsing JSON
						const nextUrl = getNextLink(response.headers.get('Link'), 'next');
						return response.json().then(data => ({ data, nextUrl }));
					})
					.then(({ data, nextUrl }) => {
						data.forEach(assignment_group => {
							if (assignment_group.integration_data.individual_assessment_extension) {
								console.log('Individual assignment group found.');
								INDIVIDUAL_ASSIGNMENT_GROUP_ID = assignment_group.id;
								assignment_data.assignment.assignment_group_id = INDIVIDUAL_ASSIGNMENT_GROUP_ID;
							}
						});

						if (!nextUrl && !INDIVIDUAL_ASSIGNMENT_GROUP_ID) {
							console.log('No individual assignment group found. Creating group...');
							createNewAssignmentGroup();
						} else if (nextUrl) {
							console.log('Getting more assignment groups...');
							getAssignmentGroups(nextUrl);
						} else {
							post_assignment(assignment_data, student_id, outcome_data[outcome_id], score, comment);
						}
					})
					.catch(error => console.error('Error:', error));
			}

			function createNewAssignmentGroup() {
				const new_assignment_group_data = {
					name: "Individual Assessments",
					integration_data: { individual_assessment_extension: true },
					position: 99
				};

				fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignment_groups`, {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						"X-CSRF-Token": getToken("_csrf_token"),
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify(new_assignment_group_data)
				})
					.then(response => response.json())
					.then(new_assignment_group => {
						console.log('New individual assignment group created.');
						assignment_data.assignment.assignment_group_id = new_assignment_group.id;
						post_assignment(assignment_data, student_id, outcome_data[outcome_id], score, comment);
					})
					.catch(error => console.error('Error:', error));
			}

			function getNextLink(linkHeader, rel) {
				if (!linkHeader) return null;
				const links = linkHeader.split(',');
				for (let link of links) {
					if (link.includes(`rel="${rel}"`)) {
						return link.substring(link.indexOf('<') + 1, link.indexOf('>'));
					}
				}
				return null;
			}

		}
	
	}

}



function add_assignment(assignment, outcome_id, outcome) {
    let date = new Date(assignment.datetime);
    let date_string = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours() % 12}:${date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()} ${date.getHours() < 12 ? "AM" : "PM"}`;

    let assignment_display_name, individual_assessment_extension;
    if (assignment.name.indexOf(' || ') > -1) {
        [assignment_display_name, individual_assessment_extension] = assignment.name.split(' ||');
    } else {
        assignment_display_name = assignment.name;
        individual_assessment_extension = '';
    }

    let assignment_row = document.createElement('div');
    assignment_row.className = 'assignment-row';
    assignment_row.innerHTML = `
        <div class="assignment-row-table" data-datetime="${assignment.datetime}">
            <div class="assessment-edit-icons">
                <a href="https://${BASE_URL}/courses/${COURSE_ID}/gradebook/speed_grader?assignment_id=${assignment.id}&student_id=${assignment.student_id}" title="Open in SpeedGrader" target="_blank" class="speedgrader-icon"><img src="https://canvas.instructure.com/dist/images/speedgrader_icon-892375741e.png"></a>
                <span title="edit" class="assessment-edit-icon">&#9998;</span>
                <span title="cancel" class="assessment-edit-cancel-icon assessment-update-cancel" hidden style="margin:2px 5px 0px 0px !important">×</span>
            </div>
            <div class="assignment-score-col">
                <span class="outcome-score">${assignment.score}</span> /${outcome.points_possible}
                <span class="outcome-result ${assignment.mastery_class}"></span>
            </div>
            <div class="assignment-comment-col">
                <h2 class="assignment-list-name">${assignment_display_name}</h2>
                <h3 class="assignment-list-date">${date_string}</h3>	
                <div class="assignment-list-comments">
                    ${assignment.comment || ''}
                </div>
            </div>
        </div>
        <div style="clear: both;"></div>
        <div class="assignment-separator"></div>`;

    document.querySelector('.sidebar-list').prepend(assignment_row);
    document.querySelector('.no-assessments')?.remove();

    let editIcon = assignment_row.querySelector('.assessment-edit-icon');
    editIcon.addEventListener('click', function(e) {
        
		// Close any other assignments that are being edited.
		document.querySelectorAll('.assessment-update-cancel').forEach(function(element) {
			element.click(); // Simulate the click event
		});

		// Hide the edit icon
		let icon = this;
		icon.style.display = 'none'; // Hide the current icon
		icon.nextElementSibling.style.display = 'inline'; // Show the cancel icon

		// Store data for the active assignment row
		let row = icon.closest('.assignment-row'); // Find the closest parent with the class 'assignment-row'
		let assignment_name = row.querySelector('.assignment-comment-col .assignment-list-name');
		let assignment_name_text = assignment_name.textContent;
		let assignment_date = row.querySelector('.assignment-comment-col .assignment-list-date').textContent;
		let assignment_score = row.querySelector('.assignment-score-col .outcome-score').textContent;
		let assignment_comment = row.querySelector('.assignment-comment-col .assignment-list-comments');
		let assignment_comment_html = assignment_comment.innerHTML;

		// Stringify comment HTML
		let assignment_comment_string = Array.from(assignment_comment.children).map(child => child.textContent).join('\n').trim();

		// Convert name into input field if this is an individual assessment
		assignment_name.innerHTML = `<input type="text" id="edit-assessment-title" value="${assignment_name_text}">`;
		let title_change = false;
		document.getElementById('edit-assessment-title').addEventListener('input', function() {
			title_change = true;
		});

		// Convert comment into input field
		assignment_comment.innerHTML = `<textarea id="edit-assessment-comment">${assignment_comment_string}</textarea>`;
		let comment_change = false;
		document.getElementById('edit-assessment-comment').addEventListener('input', function() {
			comment_change = true;
		});

		// Add rubric by cloning from the main add assessment form
		let points_change = false;
		let rubric_element = document.getElementById('rubric');
		if (rubric_element) {
			let cloned_rubric = rubric_element.cloneNode(true);
			cloned_rubric.id = 'edit-rubric';

			// Append the cloned rubric to the row
			row.querySelector('.assignment-list-date').insertAdjacentElement('afterend', cloned_rubric);

			// Deselect all rubric cells
			cloned_rubric.querySelectorAll('.rubric-selection').forEach(selection => selection.classList.remove('selected'));

			// Add click event for rubric cells
			cloned_rubric.querySelectorAll('.rubric-selection').forEach(selection => {
				selection.addEventListener('click', function() {
					cloned_rubric.querySelectorAll('.rubric-selection').forEach(sel => sel.classList.remove('selected'));
					selection.classList.toggle('selected');
					if (selection.classList.contains('selected')) {
						cloned_rubric.querySelector('.assessment-points').value = selection.dataset.points;
					} else {
						cloned_rubric.querySelector('.assessment-points').value = '';
					}
					points_change = true;
				});
			});

			// Handle manual point entry
			cloned_rubric.querySelector('.assessment-points').addEventListener('change', function() {
				points_change = true;
				let new_points = this.value;
				cloned_rubric.querySelectorAll('.rubric-selection').forEach(sel => {
					sel.classList.remove('selected');
					if (parseFloat(sel.dataset.points) == new_points) {
						sel.classList.add('selected');
					}
				});
			});

			// Set points on rubric
			cloned_rubric.querySelector('.assessment-points').value = assignment_score;
			cloned_rubric.querySelectorAll('.rubric-selection').forEach(sel => {
				if (parseFloat(sel.dataset.points) == assignment_score) {
					sel.classList.add('selected');
				}
			});
		}

		// Add Update and Cancel buttons
		let buttons_container = document.createElement('div');
		buttons_container.classList.add('assessment-update-buttons');
		row.appendChild(buttons_container);

		let cancelButton = document.createElement('button');
		cancelButton.classList.add('btn', 'btn-default', 'assessment-update-cancel');
		cancelButton.textContent = 'Cancel';
		buttons_container.appendChild(cancelButton);

		let deleteButton = document.createElement('button');
		deleteButton.classList.add('btn', 'btn-default', 'assessment-delete');
		deleteButton.textContent = 'Delete';
		buttons_container.appendChild(deleteButton);

		let updateButton = document.createElement('button');
		updateButton.classList.add('btn', 'btn-default', 'assessment-update');
		updateButton.textContent = 'Update';
		buttons_container.appendChild(updateButton);

		// Cancel editing and restore row to original state
		document.querySelectorAll('.assessment-update-cancel').forEach(button => {
			button.addEventListener('click', function(e) {
				e.preventDefault();  // Prevent default behavior of the button

				// Restore original assignment name and comment
				assignment_name.innerHTML = assignment_name_text;
				assignment_comment.innerHTML = assignment_comment_html;

				// Remove the cloned rubric and the update buttons
				document.getElementById('edit-rubric').remove(); // Assumes the cloned rubric has the id 'edit-rubric'
				document.querySelectorAll('.assessment-update-buttons').forEach(button => button.remove());

				// Hide the cancel icon and show the original edit icon
				icon.nextElementSibling.style.display = 'none';  // Hide the cancel icon
				icon.style.display = 'inline';  // Show the original edit icon
			});
		});

		// Delete assessment
		document.querySelectorAll('.assessment-delete').forEach(button => {
			button.addEventListener('click', function(e) {
				e.preventDefault();

				let student_name = document.querySelector('.sidebar-name').textContent;
				let delete_confirm;

				// If individual assignment, then just delete it, else clear out the data for the submission and assessment
				if (individual_assessment_extension.length > 0) {
					delete_confirm = confirm(`Are you sure you want to delete "${assignment_name_text}" for ${student_name}? This cannot be undone.`);
					if (delete_confirm) {
						
						fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${assignment.id}`, {
							method: 'DELETE',
							credentials: 'same-origin',
							headers: {
								"X-CSRF-Token": getToken("_csrf_token"),
								"Accept": "application/json",
								"nethod": "_delete"
							}
						})
						.then(response => {
							if (!response.ok) {
								throw new Error('Failed to delete assignment');
							}
							return response.json();
						})
						.then(() => {
							setTimeout(() => {
								update_rollup(assignment.student_id, outcome_id, outcome);
								row.remove();
							}, 3000);
						})
						.catch(error => {
							console.error('Error deleting assignment:', error);
						});
					}
				} else {
					let submission_data = {
						submission: {
							assignment_id: assignment.id,
							user_id: assignment.student_id,
							graded_anonymously: false,
							grade: ''
						},
						method: '_post'
					};

					// Update the submission to null
					fetch(`https://${BASE_URL}/courses/${COURSE_ID}/gradebook/update_submission`, {
						method: 'POST',
						credentials: 'same-origin',
						headers: {
							"X-CSRF-Token": getToken("_csrf_token"),
							"Content-Type": "application/json",
							"Accept": "application/json"
						},
						body: new URLSearchParams(submission_data)
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Failed to mark submission as null');
						}
						return response.json();
					})
					.then(() => {
						console.log('Assignment submission marked null.');
					})
					.catch(error => {
						console.error('Error updating submission:', error);
					});

					// Find the rubric_association_id from speed grader
					fetch(`https://avenues.instructure.com/courses/${COURSE_ID}/gradebook/speed_grader.json?assignment_id=${assignment.id}&student_id=${assignment.student_id}`, {
						headers: {
							'Content-Type': 'application/json'
						}
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Failed to retrieve speed grader data');
						}
						return response.json();
					})
					.then(speedgrader_data => {
						let assessment_data = {
							rubric_assessment: {
								user_id: assignment.student_id,
								assessment_type: 'grading',
							},
							graded_anonymously: false,
							_method: 'POST'
						};

						// Find the rubric criterion_id
						let criterion_id;
						assignment.rubric.forEach(criterion => {
							if (criterion.outcome_id === outcome_id) {
								criterion_id = criterion.id;
							}
						});

						assessment_data.rubric_assessment[criterion_id] = {
							description: '',
							comments: ''
						};

						// Send the request to clear the rubric assessment
						fetch(`https://${BASE_URL}/courses/${COURSE_ID}/rubric_associations/${speedgrader_data.rubric_association.id}/assessments`, {
							method: 'POST',
							credentials: 'same-origin',
							headers: {
								"X-CSRF-Token": getToken("_csrf_token"),
								"Content-Type": "application/json",
								"Accept": "application/json"
							},
							body: new URLSearchParams(assessment_data)
						})
						.then(response => {
							if (!response.ok) {
								throw new Error('Failed to update assessment');
							}
							return response.json();
						})
						.then(() => {
							setTimeout(() => {
								update_rollup(assignment.student_id, outcome_id, outcome);
								row.remove();
							}, 2000);
						})
						.catch(error => {
							console.error('Error updating assessment:', error);
						});
					})
					.catch(error => {
						console.error('Error retrieving speed grader data:', error);
					});
				}
			});
		});

		// Update assessment
		document.querySelectorAll('.assessment-update').forEach(button => {
			button.addEventListener('click', function (e) {
				e.preventDefault(); // Prevent default form submission behavior

				let submit = true;
				let assessmentPointsInput = e.target.closest(".assignment-row").querySelector('.assessment-points');
				let assessmentPoints = parseFloat(assessmentPointsInput.value);
				let editAssessmentTitleInput = document.querySelector('#edit-assessment-title');
				let editAssessmentTitle = editAssessmentTitleInput.value;

				// Validate assessment title
				if (editAssessmentTitle === '' || editAssessmentTitle.includes('[') || editAssessmentTitle.includes(']')) {
					submit = false;
					editAssessmentTitleInput.classList.add('invalid');
				} else {
					editAssessmentTitleInput.classList.remove('invalid');
				}

				// Validate assessment points
				if (isNaN(assessmentPoints) || assessmentPoints < 0 || assessmentPoints > assignment.points_possible) {
					submit = false;
					assessmentPointsInput.classList.add('invalid');
				} else {
					assessmentPointsInput.classList.remove('invalid');
				}

				if (!submit) {
					alert(`Invalid assessment input. Assessment must have a title which may not use the [ or ] characters. Assessment must have a score between 0 and ${outcome.points_possible}.`);
					return;
				}

				// Prepare data for submission
				let newCommentInput = document.querySelector('#edit-assessment-comment');
				let newCommentHTML = newCommentInput.value.split('\n').map(line => `<p>${line}</p>`).join('');

				let assignment_update_deferred = Promise.resolve(); // Initialize to a resolved promise
				let assessment_update_deferred = Promise.resolve(); // Initialize to a resolved promise

				// Update Assignment title if changed
				if (title_change) {
					let assignmentData = {
						assignment: {
							name: `${editAssessmentTitle} ${individual_assessment_extension}`
						}
					};

					assignment_update_deferred = fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/${assignment.id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json'
						},
						body: JSON.stringify(assignmentData)
					})
					.then(response => {
						if (!response.ok) throw new Error('Network response was not OK');
						return response.json();
					})
					.then(() => {
						console.log('Assignment title updated successfully.');
					})
					.catch(error => console.error('Error updating assignment:', error));
				}

				// Update Assessment points or comments if changed
				if (points_change || comment_change) {
					let criterion_id;

					// Find the rubric criterion_id
					assignment.rubric.forEach((criterion) => {
						if (criterion.outcome_id === outcome_id) {
							criterion_id = criterion.id;
						}
					});

					// Get the rubric_association_id from speed grader
					assessment_update_deferred = fetch(`https://avenues.instructure.com/courses/${COURSE_ID}/gradebook/speed_grader.json?assignment_id=${assignment.id}&student_id=${assignment.student_id}`, {
						headers: {
							'Content-Type': 'application/json'
						}
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Network response was not ok');
						}
						return response.json();
					})
					.then(speedgrader_data => {
						let assessment_data = {
							rubric_assessment: {
								user_id: assignment.student_id,
								assessment_type: 'grading',
								['criterion_' + criterion_id]: {
									points: assessmentPointsInput.value,
									description: '',
									comments: document.querySelector('#edit-assessment-comment').value
								}
							},
							graded_anonymously: false,
							_method: 'POST'
						};

						// Post the assessment update
						return fetch(`https://${BASE_URL}/courses/${COURSE_ID}/rubric_associations/${speedgrader_data.rubric_association.id}/assessments`, {
							method: 'POST',
							credentials: 'same-origin',
							headers: {
								"X-CSRF-Token": getToken("_csrf_token"),
								"Content-Type": "application/json",
								"Accept": "application/json"
							},
							body: JSON.stringify(assessment_data)
						});
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Failed to update assessment');
						}
						return response.json();
					})
					.then(() => {
						console.log('Assessment successfully updated.');
					})
					.catch(error => {
						console.error('Error updating the assessment:', error);
					});
				}

				// Once all updates (title and/or assessment) are completed, update the UI
				Promise.all([assignment_update_deferred, assessment_update_deferred])
				.then(() => {
					// Update the assignment name and comment in the UI
					row.querySelector('#edit-assessment-title').closest('.assignment-list-name').innerHTML = document.querySelector('#edit-assessment-title').value;
					row.querySelector('.assignment-list-comments').innerHTML = newCommentHTML;

					// Update the outcome score in the UI
					let outcomeScore = row.querySelector('.outcome-score');
					outcomeScore.innerHTML = assessmentPointsInput.value;

					// Determine mastery class based on assessment points and outcome cutoffs
					let mastery_class = 'remedial';
					Object.entries(outcome.cutoffs).forEach(([cutoff_class, cutoff]) => {
						if (assessmentPointsInput.value >= cutoff) {
							mastery_class = cutoff_class;
						} else {
							return false;
						}
					});

					// Update the mastery class for the outcome result
					row.querySelector('.outcome-result').classList.remove('no-mastery-data', 'remedial', 'near-master', 'mastery', 'exceeds');
					row.querySelector('.outcome-result').classList.add(mastery_class);

					// Remove the rubric and update buttons from the UI
					row.querySelector('#edit-rubric').remove();
					document.querySelectorAll('.assessment-update-buttons').forEach(button => button.remove());

					// Show the icon and hide the edit cancel icon
					icon.style.display = '';
					icon.nextElementSibling.style.display = 'none';

					// Simulating the update_rollup behavior with a timeout and promise handling
					return new Promise((resolve) => {
						setTimeout(() => {
							update_rollup(assignment.student_id, outcome_id, outcome);
							resolve();
						}, 2000);
					});
				})
				.catch(error => {
					console.error('Error updating assignment or rollup:', error);
				});
			});
		});
    });
}

function post_assignment(assignment_data, student_id, outcome, score, comment) {
    console.log('Creating assignment...');

    // Create the new assignment
    fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments`, {
        method: 'POST',
		credentials: 'same-origin',
        headers: {
			"X-CSRF-Token": getToken("_csrf_token"),
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(assignment_data)
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to create assignment');
        return response.json();
    })
    .then(new_assignment => {
        console.log('Assignment created:', new_assignment);

        // Store assignment data for adding to assignment list
        const assignment_for_list = {
            id: new_assignment.id,
            student_id: student_id,
            datetime: new_assignment.updated_at,
            score: score,
            possible: outcome.points_possible,
            mastery_class: 'remedial',
            name: assignment_data.assignment.name,
            comment: comment
        };

        Object.entries(outcome.cutoffs).forEach(([cutoff_class, cutoff]) => {
            if (score >= cutoff) {
                assignment_for_list.mastery_class = cutoff_class;
            } else {
                return false;
            }
        });

        // Check if rubric for this outcome exists
        const rubrics_url = `https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubrics`;
        getRubrics(rubrics_url);

        function getRubrics(url) {
            fetch(url, {
                headers: { 'Accept': 'application/json' }
            })
            .then(response => {
				if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
				const nextUrl = getNextLink(response.headers.get('Link'), 'next');
				return response.json().then(data => ({ data, nextUrl }));
			})
			.then(({ data, nextUrl }) => {
                let criterion_id = null;
                let rubric_association_id = false;

                data.forEach(rubric => {
                    if (rubric.title.includes(`[${outcome.id}]`)) {
                        console.log("Rubric exists. Adding association...");
                        const rubric_association_data = new URLSearchParams({
                            'rubric_association[association_type]': 'Assignment',
                            'rubric_association[association_id]': new_assignment.id,
                            'rubric_association[rubric_id]': rubric.id,
                            'rubric_association[purpose]': 'grading'
                        });

                        rubric_association_id = true;

                        fetch(`https://avenues.instructure.com/courses/${COURSE_ID}/rubric_associations`, {
                            method: 'POST',
                            credentials: 'same-origin',
							headers: {
								"X-CSRF-Token": getToken("_csrf_token"),
								"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
								"Accept": "application/json"
							},
                            body: rubric_association_data
                        })
                        .then(response => {
							if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
							const nextUrl = getNextLink(response.headers.get('Link'), 'next');
							return response.json().then(data => ({ data, nextUrl }));
						})
                        .then(({ data, nextUrl }) => {
                            console.log("New rubric association created:");
                            criterion_id = `criterion_${data.rubric.criteria[0].id}`;
                            rubric_association_id = data.rubric_association.id;
                            post_assessment(student_id, outcome, criterion_id, score, comment, rubric_association_id, assignment_for_list);
                        })
                        .catch(error => console.error('Error creating rubric association:', error));

                        return false; // Stop the loop once the rubric is found
                    }
                });

                if (!nextUrl && !rubric_association_id) {
                    // Add new rubric if none exists
                    console.log('Rubric does not exist. Creating new rubric...');

                    let token = getToken("_csrf_token")
					let rubric_data = new URLSearchParams();
					rubric_data.append("rubric[title]", `Rubric for ${new_assignment.name}`);
					rubric_data.append("rubric[points_possible]", outcome.points_possible);
					rubric_data.append("rubric_association[use_for_grading]", 0);
					rubric_data.append("rubric_association[hide_score_total]", 1);
					rubric_data.append("rubric_association[hide_points]", 0);
					rubric_data.append("rubric_association[hide_outcome_results]", 0);
					rubric_data.append("rubric[free_form_criterion_comments]", 1);
					rubric_data.append("rubric_association[id]", "");
					rubric_data.append("rubric_association_id", "");
					rubric_data.append("rubric[criteria][0][description]", outcome.name);
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
					rubric_data.append("title", `Rubric for ${new_assignment.name}`);
					rubric_data.append("points_possible", 3);
					rubric_data.append("rubric_id", "new");
					rubric_data.append("rubric_association[association_type]", "Assignment");
					rubric_data.append("rubric_association[association_id]", new_assignment.id);
					rubric_data.append("rubric_association[purpose]", "grading");
					rubric_data.append("skip_updating_points_possible", false);
					rubric_data.append("_method", "POST");
					rubric_data.append("authenticity_token", token);

                    fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/rubrics`, {
                        method: 'POST',
                        credentials: 'same-origin',
						headers: {
							"X-CSRF-Token": getToken("_csrf_token"),
							"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
							"Accept": "application/json"
						},
                        body: rubric_data
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to create rubric');
                        return response.json();
                    })
                    .then(new_rubric_data => {
                        console.log('Rubric created:');
                        criterion_id = `criterion_${new_rubric_data.rubric.criteria[0].id}`;
                        rubric_association_id = new_rubric_data.rubric_association.id;
                        post_assessment(student_id, outcome, criterion_id, score, comment, rubric_association_id, assignment_for_list);
                    })
                    .catch(error => console.error('Error creating rubric:', error));
                } else if (nextUrl) {
                    console.log('Getting more rubrics...');
                    getRubrics(nextUrl);
                }
            })
            .catch(error => console.error('Error getting rubrics:', error));
        }
    })
    .catch(error => console.error('Error creating assignment:', error));
}

function post_assessment(student_id, outcome, criterion_id, score, comment, rubric_association_id, assignment_for_list) {
    console.log('Adding assessment...');

    // Prepare submission data
    const submission_data = {
        submission: {
			posted_grade: 'complete'
		}
    };

    // Post the assignment submission
    fetch(`https://${BASE_URL}/courses/${COURSE_ID}/assignments/${assignment_for_list.id}/submissions/${student_id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
			"X-CSRF-Token": getToken("_csrf_token"),
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(submission_data)
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update submission');
        return response.json();
    })
    .then(new_submission_data => {
        console.log('Assignment submission marked complete.');
    })
    .catch(error => console.error('Error marking assignment submission complete:', error));

    // Prepare assessment data
    const assessment_data = new URLSearchParams({
        'rubric_assessment[user_id]': student_id,
        'rubric_assessment[assessment_type]': 'grading',
        '_method': 'POST'
    });
    assessment_data.append(`rubric_assessment[${criterion_id}][points]`, score);
    assessment_data.append(`rubric_assessment[${criterion_id}][description]`, '');
    assessment_data.append(`rubric_assessment[${criterion_id}][comments]`, comment);

    // Post the assessment
    fetch(`https://${BASE_URL}/courses/${COURSE_ID}/rubric_associations/${rubric_association_id}/assessments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
			"X-CSRF-Token": getToken("_csrf_token"),
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json"
        },
        body: assessment_data
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to create assessment');
        return response.json();
    })
    .then(new_assessment_data => {
        console.log('Assessment created.');

        // Add assignment to the top of the list
        add_assignment(assignment_for_list, outcome.id, outcome);

        // Get new rollup and update sidebar-header and slick grid data
        setTimeout(() => update_rollup(student_id, outcome.id, outcome), 2000);

        // Clear form, hide spinner, and close form toggle
        document.getElementById('assessment-title').value = '';
        document.querySelectorAll('.rubric-cell').forEach(cell => cell.classList.remove('selected'));
        document.getElementById('new-assessment-form').querySelector('.assessment-points').value = '';
        document.getElementById('assessment-date').value = new Date().toISOString().replace('T', ' ').substr(0, 16);
        document.getElementById('assessment-comment').value = '';

        const form = document.getElementById('new-assessment-form');
        const assessmentLabel = document.getElementById('new-assessment-label');
        const hideFormLabel = document.getElementById('hide-form-label');

        form.hidden = form.hidden === true ? false : true;
        assessmentLabel.hidden = assessmentLabel.hidden === true ? false : true;
        hideFormLabel.hidden = hideFormLabel.hidden === true ? false : true;
        document.getElementById("new-assessment-label").hidden = false;

        document.getElementById('new-assignment-overlay').style.display = 'none';
        document.getElementById('new-assignment-spinner').style.display = 'none';
    })
    .catch(error => console.error('Error creating assessment:', error));
}

function update_rollup(student_id, outcome_id, outcome) {
    // Fetch outcome rollups for the specified student and outcome
    fetch(`https://${BASE_URL}/api/v1/courses/${COURSE_ID}/outcome_rollups?per_page=5&user_ids[]=${student_id}&outcome_ids[]=${outcome_id}`, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch outcome rollups');
        }
        return response.json();
    })
    .then(data => {
        // Determine mastery class and score
        let mastery_class = 'remedial';
        let new_score = '-';

        if (data.rollups[0].scores.length === 0) {
            mastery_class = 'no-mastery-data';
        } else {
            new_score = data.rollups[0].scores[0].score;
            Object.entries(outcome.cutoffs).forEach(([cutoff_class, cutoff]) => {
                if (new_score >= cutoff) {
                    mastery_class = cutoff_class;
                } else {
                    return false; // Exit loop early if condition fails
                }
            });
        }

        // Update rollup in grid
        const outcomeCell = document.getElementById(`${student_id}__${outcome_id}`);
		const profScore = outcomeCell.querySelector('.outcome-cell-wrapper').textContent.split("/")[1].trim();
        outcomeCell.querySelector('.outcome-score').textContent = `${new_score} /${profScore}`;
        const outcomeResult = outcomeCell.querySelector('.outcome-result');
        outcomeResult.classList.remove('no-mastery-data', 'remedial', 'near-mastery', 'mastery', 'exceeds');
        outcomeResult.classList.add(mastery_class);

        // Update sidebar header
        const sidebarHeader = document.querySelector('.sidebar-header');
        sidebarHeader.querySelector('.outcome-score').textContent = new_score;
        const sidebarOutcomeResult = sidebarHeader.querySelector('.outcome-result');
        sidebarOutcomeResult.classList.remove('no-mastery-data', 'remedial', 'near-mastery', 'mastery', 'exceeds');
        sidebarOutcomeResult.classList.add(mastery_class);

        console.log('Rollup updated successfully.');
    })
    .catch(error => {
        console.error('Error updating rollup:', error);
    });
}

function getNextLink(linkHeader, rel) {
	if (!linkHeader) return null;
	const links = linkHeader.split(',').map(link => link.trim());
	const nextLink = links.find(link => link.includes(`rel="${rel}"`));
	return nextLink ? nextLink.slice(nextLink.indexOf('<') + 1, nextLink.indexOf('>')) : null;
}

function getToken(name){
	if (!document.cookie) {
		return null;
	  }
	
	  const xsrfCookies = document.cookie.split(';')
		.map(c => c.trim())
		.filter(c => c.startsWith(name + '='));
	
	  if (xsrfCookies.length === 0) {
		return null;
	  }
	  return decodeURIComponent(xsrfCookies[0].split('=')[1]);
}