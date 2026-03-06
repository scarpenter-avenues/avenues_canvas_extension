var url = new URL(window.location.href);
var BASE_URL = url.searchParams.get("base_url");
var COURSE_ID = url.searchParams.get("course_id");
var ASSIGNMENT_ID = url.searchParams.get("assignment_id");

var submission_data = null;
var submission_url = "https://"+BASE_URL+"/api/v1/courses/"+COURSE_ID+"/assignments/"+ASSIGNMENT_ID+"/submissions?per_page=100&include[]=assignment&include[]=rubric_assessment";

var sections = {}
var student_sections = {}

getSubmissions(submission_url)

function getSubmissions(url){
	Promise.all([
		fetch(url, {
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
		build_report(data);
	});
	
}

function build_report(submission_data){
	
	document.getElementById("loading").hidden = true;
	
	// Create the form and append it to the body
	var optionsForm = document.createElement('form');
	optionsForm.id = 'options-form';
	optionsForm.classList.add('no-print');
	optionsForm.innerHTML = `
		<h2>Display Options</h2>
		<div class="form-element" id="sections-list">
			<label>Show sections: </label>
		</div>
		`;
	document.body.appendChild(optionsForm);

	var assignment = submission_data[0].assignment;

	// Loop through sections
	Object.keys(sections).forEach(function(section_id) {
		var section = sections[section_id];

		if (section.students) {
			// Append section checkbox to #sections-list
			var sectionCheckboxHTML = `<span><input type="checkbox" id="${section_id}--checkbox" checked> ${section.name} &nbsp;&nbsp;&nbsp;</span>`;
			document.getElementById('sections-list').insertAdjacentHTML('beforeend', sectionCheckboxHTML);

			// Handle section checkbox click to show/hide section
			document.getElementById(section_id + '--checkbox').addEventListener('click', function(e) {
				var sectionDiv = document.getElementById(section_id);
				sectionDiv.style.display = e.target.checked ? 'block' : 'none';
			});

			// Create section div and append to body
			var sectionDiv = document.createElement('div');
			sectionDiv.id = section_id;
			sectionDiv.classList.add('page');
			sectionDiv.innerHTML = `
				<h2>${assignment.name}</h2>
				<h2>Section ${section.name}</h2>
				<table class="assignment-table">
					<tr class="header-row">
						<th class="name-header">Student &#8645;</th>
					</tr>
				</table>`;
			document.body.appendChild(sectionDiv);

			// Append students to the section table
			section.students.forEach(function(student) {
				var studentRowHTML = `<tr id="u${student.id}"><td>${student.sortable_name}</td></tr>`;
				sectionDiv.querySelector('.assignment-table').insertAdjacentHTML('beforeend', studentRowHTML);

				// Append rubric score columns for each student
				assignment.rubric.forEach(function(rubric_row) {
					var rubric_row_id_class = "rubric-row" + rubric_row.id.replace('_', '-');
					var scoreCellHTML = `<td class="score ${rubric_row_id_class}"></td>`;
					document.getElementById(`u${student.id}`).insertAdjacentHTML('beforeend', scoreCellHTML);
				});
			});
		}
	});

	// Append rubric headers to the table
	assignment.rubric.forEach(function(rubric_row) {
		var headerCellHTML = `<th>${rubric_row.description}</br>&#8645;</th>`;
		document.querySelectorAll('.header-row').forEach(function(row) {
			row.insertAdjacentHTML('beforeend', headerCellHTML);
		});
	});

	// Populate the table with rubric assessments
	submission_data.forEach(function(submission) {
		if (submission.rubric_assessment) {
			Object.keys(submission.rubric_assessment).forEach(function(id) {
				var rubric_row_id_class = "rubric-row" + id.replace('_', '-');
				var assessment = submission.rubric_assessment[id];
				document.getElementById(`u${submission.user_id}`).querySelector(`.${rubric_row_id_class}`).textContent = assessment.points;
			});
		}
	});

	// Table sorting functionality
	document.querySelectorAll('th').forEach(function(header) {
		header.addEventListener('click', function() {
			var table = this.closest('table');
			// var rows = Array.from(table.querySelectorAll('tr:nth-child(n+2)')); // Skip header row
			var rows = Array.from(table.querySelectorAll('tr')).slice(1);
			var asc = this.asc = !this.asc; // Toggle sorting direction
			rows.sort(comparer(Array.from(this.parentNode.children).indexOf(this), asc));

			rows.forEach(function(row) {
				table.appendChild(row); // Re-append sorted rows
			});
		});
	});

	function comparer(index, asc) {
		return function(a, b) {
			var valA = getCellValue(a, index);
			var valB = getCellValue(b, index);
			return isNumeric(valA) && isNumeric(valB) ? (asc ? valA - valB : valB - valA) : valA.localeCompare(valB);
		};
	}

	function getCellValue(row, index) {
		return row.children[index].textContent;
	}

	function isNumeric(value) {
		return !isNaN(value - parseFloat(value));
	}

}