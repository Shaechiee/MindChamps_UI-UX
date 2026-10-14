(function () {
  "use strict";

  const DATA_KEY = "mindchamps.attendance.data.v1";
  const SESSION_KEY = "mindchamps.attendance.session.v1";
  const root = document.getElementById("portal-root");
  const viewNames = {
    dashboard: "Dashboard",
    classes: "Classes",
    class: "Class details",
    "create-class": "Create class",
    attendance: "Attendance",
    reports: "Weekly reports",
    archives: "Archives",
    profile: "Personal information",
    staff: "Teacher accounts"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function loadData() {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) {
      const initial = {
        users: [{
          id: "admin-1",
          role: "admin",
          name: "School Administrator",
          email: "admin@mindchamps.local",
          password: "Admin123!"
        }],
        classes: [],
        records: [],
        archives: []
      };
      localStorage.setItem(DATA_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error("Saved portal data could not be read. Clear this site's local storage to start a fresh prototype.");
    }
  }

  function saveData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function currentUser(data) {
    const id = localStorage.getItem(SESSION_KEY);
    return data.users.find(function (user) { return user.id === id; }) || null;
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function go(view, parameters) {
    const query = new URLSearchParams(Object.assign({ view: view }, parameters || {}));
    window.location.href = "portal.html?" + query.toString();
  }

  function mondayOf(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysSinceMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysSinceMonday);
    return localDate(monday);
  }

  function localDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateLabel(value) {
    if (!value) return "—";
    return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  function classFor(data, classId) {
    return data.classes.find(function (item) { return item.id === classId; });
  }

  function visibleClasses(data, user) {
    return user.role === "admin"
      ? data.classes
      : data.classes.filter(function (item) { return item.teacherId === user.id; });
  }

  function statusBadge(status) {
    return '<span class="portal-status ' + (status === "Present" ? "is-present" : "is-absent") + '">' +
      escapeHtml(status) + "</span>";
  }

  function renderShell(data, user, view, content) {
    const links = [
      ["dashboard", "Overview"],
      ["classes", "Classes"],
      ["attendance", "Attendance"],
      ["reports", "Reports"],
      ["archives", "Archives"],
      ["profile", "My profile"]
    ];
    if (user.role === "admin") links.splice(1, 0, ["staff", "Teacher accounts"]);
    const activeView = view === "class" ? "classes" : view;
    const initials = user.name.split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join("").toUpperCase();

    root.innerHTML =
      '<header class="app-top portal-top"><nav class="app-nav" aria-label="Main navigation">' +
        '<a class="logo logo-dark" href="portal.html?view=dashboard" aria-label="MindChamps dashboard">' +
          '<span class="logo-mind">M&#305;nd</span><span class="logo-champs">Champs</span>' +
        '</a><ul class="app-links">' +
          links.map(function (link) {
            return '<li><a href="portal.html?view=' + link[0] + '"' +
              (activeView === link[0] ? ' class="is-active" aria-current="page"' : "") + ">" +
              escapeHtml(link[1]) + "</a></li>";
          }).join("") +
        '</ul><div class="portal-user"><span class="user-avatar">' + escapeHtml(initials) +
          '</span><span class="user-name">' + escapeHtml(user.name) + '</span>' +
          '<button type="button" class="portal-logout" data-action="logout">Log out</button></div>' +
      '</nav></header><main class="portal-main"><div class="portal-heading"><div>' +
        '<p class="portal-eyebrow">' + (user.role === "admin" ? "ADMINISTRATOR" : "TEACHER") +
        '</p><h1>' + escapeHtml(viewNames[view] || "Class details") + '</h1></div>' +
        (view === "classes" ? '<a class="portal-button" href="portal.html?view=create-class">+ Create class</a>' : "") +
      '</div>' + content + '</main>';
  }

  function renderDashboard(data, user) {
    const classes = visibleClasses(data, user);
    const classIds = classes.map(function (item) { return item.id; });
    const records = data.records.filter(function (record) {
      return classIds.indexOf(record.classId) !== -1;
    });
    const today = localDate(new Date());
    const todayRecords = records.filter(function (record) { return record.date === today; });
    const todayEntries = todayRecords.reduce(function (all, record) {
      return all.concat(record.entries);
    }, []);
    const present = todayEntries.filter(function (entry) { return entry.status === "Present"; }).length;
    const absent = todayEntries.filter(function (entry) { return entry.status === "Absent"; }).length;

    const content =
      '<section class="portal-welcome"><div><span class="portal-eyebrow">YOUR ATTENDANCE WORKSPACE</span>' +
        '<h2>Welcome back, ' + escapeHtml(user.name.split(/\s+/)[0]) + '</h2>' +
        '<p>Manage your classes, record daily attendance, and keep weekly reports in one place.</p></div>' +
        '<a class="portal-button portal-button-light" href="portal.html?view=create-class">Create a class</a></section>' +
      '<section class="portal-stats" aria-label="Attendance summary">' +
        statCard("My classes", classes.length, "Active classes") +
        statCard("Present today", present, dateLabel(today)) +
        statCard("Absent today", absent, "Across recorded attendance") +
        statCard("Archived reports", data.archives.filter(function (archive) {
          return user.role === "admin" || archive.ownerId === user.id;
        }).length, "Saved report snapshots") +
      '</section><section class="portal-panel"><div class="portal-panel-heading"><div>' +
        '<h2>Recent classes</h2><p>Your classes and their current student counts.</p></div>' +
        '<a class="portal-text-link" href="portal.html?view=classes">View all</a></div>' +
        classTable(classes, data, user) + '</section>' +
      (user.role === "admin"
        ? '<p class="portal-notice">Prototype mode: accounts and attendance are stored only in this browser. Do not use real passwords or sensitive student information.</p>'
        : "");
    renderShell(data, user, "dashboard", content);
  }

  function statCard(title, value, caption) {
    return '<article class="portal-stat"><span>' + escapeHtml(title) + '</span><strong>' +
      escapeHtml(value) + '</strong><small>' + escapeHtml(caption) + "</small></article>";
  }

  function classTable(classes, data, user) {
    if (!classes.length) {
      return '<div class="portal-empty"><strong>No classes yet</strong><p>Create a class and add its students to get started.</p>' +
        '<a class="portal-button" href="portal.html?view=create-class">Create your first class</a></div>';
    }
    return '<div class="portal-table-wrap"><table class="portal-table"><thead><tr>' +
      '<th>Class</th><th>Students</th><th>Teacher</th><th>Room / schedule</th><th></th>' +
      '</tr></thead><tbody>' + classes.map(function (item) {
        const teacher = data.users.find(function (person) { return person.id === item.teacherId; });
        return '<tr><td><strong>' + escapeHtml(item.name) + '</strong><small>' +
          escapeHtml(item.level || "Class") + '</small></td><td>' + item.students.length +
          '</td><td>' + escapeHtml(teacher ? teacher.name : user.name) + '</td><td>' +
          escapeHtml([item.room, item.schedule].filter(Boolean).join(" · ") || "Not set") +
          '</td><td><a class="portal-text-link" href="portal.html?view=class&classId=' +
          encodeURIComponent(item.id) + '">Manage</a></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  function renderClasses(data, user) {
    const classes = visibleClasses(data, user);
    renderShell(data, user, "classes",
      '<section class="portal-panel"><div class="portal-panel-heading"><div>' +
        '<h2>Class list</h2><p>Open a class to manage its roster or take attendance.</p></div></div>' +
        classTable(classes, data, user) + '</section>');
  }

  function renderCreateClass(data, user) {
    const teachers = data.users.filter(function (person) { return person.role === "teacher"; });
    const teacherField = user.role === "admin"
      ? '<label class="portal-field">Teacher<select name="teacherId" required>' +
        '<option value="">Choose a teacher</option>' + teachers.map(function (teacher) {
          return '<option value="' + escapeHtml(teacher.id) + '">' + escapeHtml(teacher.name) +
            " · " + escapeHtml(teacher.email) + "</option>";
        }).join("") + '</select></label>'
      : "";
    const noTeacher = user.role === "admin" && !teachers.length
      ? '<p class="portal-notice">Create a teacher account before assigning classes.</p>' : "";
    renderShell(data, user, "create-class",
      '<section class="portal-panel portal-form-panel"><h2>Class information</h2>' +
        '<p>Set up the class and add student names, one per line.</p>' + noTeacher +
        '<form class="portal-form" data-form="create-class">' +
          '<div class="portal-form-grid"><label class="portal-field">Class name<input name="name" required maxlength="80" placeholder="e.g. Sunflower Room"></label>' +
          '<label class="portal-field">Grade / level<input name="level" maxlength="60" placeholder="e.g. Preschool 2"></label>' +
          '<label class="portal-field">Room<input name="room" maxlength="60" placeholder="e.g. Room 4"></label>' +
          '<label class="portal-field">Schedule<input name="schedule" maxlength="100" placeholder="e.g. Mon–Fri, 8:00 AM"></label>' +
          teacherField + '</div><label class="portal-field">Students<textarea name="students" required rows="7" placeholder="Avery Santos&#10;Jordan Lee&#10;One student per line"></textarea><small>Enter at least one student. You can add more from the class roster later.</small></label>' +
          '<div class="portal-form-actions"><a class="portal-button portal-button-muted" href="portal.html?view=classes">Cancel</a>' +
          '<button class="portal-button" type="submit"' + (user.role === "admin" && !teachers.length ? " disabled" : "") +
          '>Save class and students</button></div></form></section>');
  }

  function renderClass(data, user) {
    const classId = new URLSearchParams(window.location.search).get("classId");
    const item = classFor(data, classId);
    if (!item || (user.role !== "admin" && item.teacherId !== user.id)) {
      renderShell(data, user, "classes", '<section class="portal-panel portal-empty"><strong>Class not found</strong>' +
        '<p>This class may have been removed or you may not have access to it.</p>' +
        '<a class="portal-button" href="portal.html?view=classes">Back to classes</a></section>');
      return;
    }
    const roster = item.students.length
      ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Student</th><th>Student ID</th></tr></thead><tbody>' +
        item.students.map(function (student, index) {
          return '<tr><td>' + escapeHtml(student.name) + '</td><td>STU-' +
            String(index + 1).padStart(3, "0") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<p class="portal-empty">No students have been added yet.</p>';
    const content = '<section class="portal-panel"><div class="portal-panel-heading"><div>' +
      '<h2>' + escapeHtml(item.name) + '</h2><p>' +
      escapeHtml([item.level, item.room, item.schedule].filter(Boolean).join(" · ") || "Class details not set") +
      '</p></div><a class="portal-button" href="portal.html?view=attendance&classId=' +
      encodeURIComponent(item.id) + '">Take attendance</a></div>' + roster +
      '<form class="portal-inline-form" data-form="add-student"><input type="hidden" name="classId" value="' +
      escapeHtml(item.id) + '"><label class="portal-field">Add a student<input name="student" required maxlength="100" placeholder="Student full name"></label>' +
      '<button class="portal-button" type="submit">Add student</button></form></section>';
    renderShell(data, user, "class", content);
  }

  function renderAttendance(data, user) {
    const classes = visibleClasses(data, user);
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get("classId") || (classes[0] && classes[0].id) || "";
    const selectedClass = classFor(data, selectedId);
    const date = params.get("date") || localDate(new Date());
    const record = data.records.find(function (item) {
      return item.classId === selectedId && item.date === date;
    });
    const options = classes.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (item.id === selectedId ? " selected" : "") +
        ">" + escapeHtml(item.name) + "</option>";
    }).join("");
    let roster;
    if (!classes.length) {
      roster = '<div class="portal-empty"><strong>Create a class before taking attendance</strong>' +
        '<a class="portal-button" href="portal.html?view=create-class">Create a class</a></div>';
    } else if (!selectedClass.students.length) {
      roster = '<div class="portal-empty">Add students to this class before taking attendance.</div>';
    } else {
      roster = '<form class="portal-form" data-form="attendance"><input type="hidden" name="classId" value="' +
        escapeHtml(selectedId) + '"><input type="hidden" name="date" value="' + escapeHtml(date) + '">' +
        '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Student</th><th>Attendance status</th></tr></thead><tbody>' +
        selectedClass.students.map(function (student) {
          const saved = record && record.entries.find(function (entry) { return entry.studentId === student.id; });
          const status = saved ? saved.status : "";
          return '<tr><td><strong>' + escapeHtml(student.name) + '</strong></td><td><select name="status-' +
            escapeHtml(student.id) + '" required aria-label="Attendance for ' + escapeHtml(student.name) + '">' +
            '<option value=""' + (!status ? " selected" : "") + '>Choose status</option>' +
            '<option value="Present"' + (status === "Present" ? " selected" : "") + '>Present</option>' +
            '<option value="Absent"' + (status === "Absent" ? " selected" : "") + '>Absent</option></select></td></tr>';
        }).join("") + '</tbody></table></div><div class="portal-form-actions">' +
        '<span class="portal-muted">' + (record ? "Saved record · last updated " +
          new Date(record.updatedAt).toLocaleString() : "Select a status for every student.") + '</span>' +
        '<button class="portal-button" type="submit">Save attendance</button></div></form>';
    }
    renderShell(data, user, "attendance",
      '<section class="portal-panel"><div class="portal-filter-row"><label class="portal-field">Class<select id="attendance-class">' +
      '<option value="">Choose a class</option>' + options + '</select></label><label class="portal-field">Date<input id="attendance-date" type="date" value="' +
      escapeHtml(date) + '"></label></div><h2 class="portal-section-heading">' +
      (selectedClass ? escapeHtml(selectedClass.name) : "Attendance roster") + " · " + dateLabel(date) +
      '</h2>' + roster + '</section>');
  }

  function recordsForWeek(data, user, startDate) {
    const end = new Date(startDate + "T12:00:00");
    end.setDate(end.getDate() + 6);
    const endDate = localDate(end);
    const allowed = visibleClasses(data, user).map(function (item) { return item.id; });
    return {
      start: startDate,
      end: endDate,
      records: data.records.filter(function (record) {
        return allowed.indexOf(record.classId) !== -1 && record.date >= startDate && record.date <= endDate;
      }).sort(function (a, b) { return a.date.localeCompare(b.date); })
    };
  }

  function reportRows(data, records) {
    return records.reduce(function (rows, record) {
      const item = classFor(data, record.classId);
      return rows.concat(record.entries.map(function (entry) {
        return {
          date: record.date,
          className: item ? item.name : "Class",
          student: entry.name,
          status: entry.status
        };
      }));
    }, []);
  }

  function reportSummary(data, records) {
    const rows = reportRows(data, records);
    const present = rows.filter(function (row) { return row.status === "Present"; }).length;
    const absent = rows.length - present;
    return { rows: rows, present: present, absent: absent };
  }

  function reportTable(rows) {
    if (!rows.length) {
      return '<div class="portal-empty"><strong>No attendance saved for this week</strong>' +
        '<p>Record attendance for a class first. The report will include all saved records in the selected week.</p></div>';
    }
    return '<div class="portal-table-wrap"><table class="portal-table"><thead><tr>' +
      '<th>Date</th><th>Class</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return "<tr><td>" + dateLabel(row.date) + "</td><td>" + escapeHtml(row.className) +
          "</td><td>" + escapeHtml(row.student) + "</td><td>" + statusBadge(row.status) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function renderReports(data, user) {
    const requestedStart = new URLSearchParams(window.location.search).get("weekStart") || mondayOf(new Date());
    const startDate = mondayOf(new Date(requestedStart + "T12:00:00"));
    const report = recordsForWeek(data, user, startDate);
    const summary = reportSummary(data, report.records);
    const content = '<section class="portal-panel"><div class="portal-filter-row"><label class="portal-field">Week starting (Monday)<input id="report-week" type="date" value="' +
      escapeHtml(startDate) + '"></label><span class="portal-muted">Report period: ' + dateLabel(report.start) +
      " – " + dateLabel(report.end) + '</span></div><div class="portal-stats portal-report-stats">' +
      statCard("Attendance entries", summary.rows.length, "Students recorded") +
      statCard("Present", summary.present, "Attendance records") +
      statCard("Absent", summary.absent, "Attendance records") +
      '</div><div class="portal-panel-heading"><div><h2>Weekly attendance report</h2>' +
      '<p>Export a copy or save a dated snapshot in Archives.</p></div><div class="portal-actions">' +
      '<button type="button" class="portal-button portal-button-muted" data-action="csv" data-source="weekly">Export CSV</button>' +
      '<button type="button" class="portal-button portal-button-muted" data-action="print">Save as PDF</button>' +
      '<a class="portal-button portal-button-muted" href="' + emailLink(report.start, report.end, summary.rows) +
      '">Email report</a><button type="button" class="portal-button" data-action="archive" data-start="' +
      escapeHtml(report.start) + '" data-end="' + escapeHtml(report.end) + '">Archive report</button></div></div>' +
      reportTable(summary.rows) + '<p class="portal-muted">Email report opens your mail app with a summary; attach the downloaded PDF there if needed.</p></section>';
    renderShell(data, user, "reports", content);
  }

  function emailLink(start, end, rows) {
    const present = rows.filter(function (row) { return row.status === "Present"; }).length;
    const absent = rows.length - present;
    const subject = encodeURIComponent("Weekly attendance report: " + start + " to " + end);
    const body = encodeURIComponent(
      "Weekly attendance report\n" + start + " to " + end + "\n\n" +
      "Attendance entries: " + rows.length + "\nPresent: " + present + "\nAbsent: " + absent +
      "\n\nTo include the full report, export the PDF and attach it to this email."
    );
    return "mailto:?subject=" + subject + "&body=" + body;
  }

  function renderArchives(data, user) {
    const archives = data.archives.filter(function (archive) {
      return user.role === "admin" || archive.ownerId === user.id;
    }).sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });
    const content = '<section class="portal-panel"><div class="portal-panel-heading"><div>' +
      '<h2>Archived attendance reports</h2><p>Saved weekly snapshots remain available even as new attendance is recorded.</p></div></div>' +
      (archives.length ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr>' +
        '<th>Report period</th><th>Archived</th><th>Entries</th><th>Present</th><th>Absent</th><th>Export</th>' +
        '</tr></thead><tbody>' + archives.map(function (archive) {
          const rows = archive.rows || [];
          const present = rows.filter(function (row) { return row.status === "Present"; }).length;
          return '<tr><td><strong>' + dateLabel(archive.start) + " – " + dateLabel(archive.end) +
            '</strong></td><td>' + new Date(archive.createdAt).toLocaleString() + '</td><td>' + rows.length +
            '</td><td>' + present + '</td><td>' + (rows.length - present) +
            '</td><td><div class="portal-actions"><button type="button" class="portal-button portal-button-small portal-button-muted" data-action="csv" data-source="archive" data-id="' +
            escapeHtml(archive.id) + '">CSV</button><button type="button" class="portal-button portal-button-small portal-button-muted" data-action="print-archive" data-id="' +
            escapeHtml(archive.id) + '">PDF</button><a class="portal-text-link" href="' +
            emailLink(archive.start, archive.end, rows) + '">Email</a></div></td></tr>';
        }).join("") + "</tbody></table></div>" :
        '<div class="portal-empty"><strong>No archived reports yet</strong><p>Open Reports, choose a week, and select “Archive report”.</p>' +
        '<a class="portal-button" href="portal.html?view=reports">Go to reports</a></div>') +
      '<p class="portal-muted">PDF opens the browser print dialog; choose “Save as PDF”. Email opens your mail app and does not attach files automatically.</p></section>';
    renderShell(data, user, "archives", content);
  }

  function renderProfile(data, user) {
    renderShell(data, user, "profile",
      '<section class="portal-panel portal-form-panel"><h2>Personal information</h2>' +
      '<p>Update the profile details connected to your account.</p><form class="portal-form" data-form="profile">' +
      '<div class="portal-form-grid"><label class="portal-field">Full name<input name="name" required maxlength="100" value="' +
      escapeHtml(user.name) + '"></label><label class="portal-field">Email address<input name="email" type="email" required maxlength="160" value="' +
      escapeHtml(user.email) + '"></label></div><div class="portal-form-actions">' +
      '<button class="portal-button" type="submit">Save personal information</button></div></form>' +
      '<div class="portal-security-note"><strong>Change password</strong><p>Choose a new password. In this browser-only prototype, passwords are not securely stored.</p>' +
      '<form class="portal-inline-form" data-form="change-password"><label class="portal-field">Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label>' +
      '<label class="portal-field">New password<input name="newPassword" type="password" minlength="8" required autocomplete="new-password"></label>' +
      '<button class="portal-button portal-button-muted" type="submit">Change password</button></form></div></section>');
  }

  function renderStaff(data, user) {
    if (user.role !== "admin") {
      go("dashboard");
      return;
    }
    const teachers = data.users.filter(function (person) { return person.role === "teacher"; });
    const table = teachers.length
      ? '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Teacher</th><th>Email</th><th>Classes</th><th>Created</th></tr></thead><tbody>' +
        teachers.map(function (teacher) {
          const count = data.classes.filter(function (item) { return item.teacherId === teacher.id; }).length;
          return '<tr><td><strong>' + escapeHtml(teacher.name) + '</strong></td><td>' +
            escapeHtml(teacher.email) + '</td><td>' + count + '</td><td>' +
            (teacher.createdAt ? dateLabel(teacher.createdAt.slice(0, 10)) : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<div class="portal-empty">No teacher accounts have been created.</div>';
    renderShell(data, user, "staff",
      '<section class="portal-panel portal-form-panel"><h2>Create teacher account</h2>' +
      '<p>Teachers can sign in, manage their classes, record attendance, and export reports.</p>' +
      '<form class="portal-form" data-form="create-teacher"><div class="portal-form-grid">' +
      '<label class="portal-field">Teacher full name<input name="name" required maxlength="100"></label>' +
      '<label class="portal-field">Email address<input name="email" type="email" required maxlength="160"></label>' +
      '<label class="portal-field">Temporary password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>' +
      '</div><div class="portal-form-actions"><button class="portal-button" type="submit">Create teacher account</button></div></form></section>' +
      '<section class="portal-panel"><div class="portal-panel-heading"><div><h2>Teacher accounts</h2>' +
      '<p>Use a unique email address for each account.</p></div></div>' + table + '</section>');
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function downloadCsv(fileName, rows) {
    const header = ["Date", "Class", "Student", "Status"];
    const content = [header].concat(rows.map(function (row) {
      return [row.date, row.className, row.student, row.status];
    })).map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function activeReport(data, user) {
    const start = new URLSearchParams(window.location.search).get("weekStart") || mondayOf(new Date());
    const report = recordsForWeek(data, user, start);
    return { start: report.start, end: report.end, rows: reportRows(data, report.records) };
  }

  function handleSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = loadData();
    const user = currentUser(data);
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const values = new FormData(form);
    const formType = form.dataset.form;

    if (formType === "create-teacher") {
      const email = String(values.get("email")).trim().toLowerCase();
      if (data.users.some(function (person) { return person.email.toLowerCase() === email; })) {
        alert("An account with that email already exists.");
        return;
      }
      data.users.push({
        id: id(), role: "teacher", name: String(values.get("name")).trim(),
        email: email, password: String(values.get("password")), createdAt: new Date().toISOString()
      });
      saveData(data);
      renderStaff(data, user);
      alert("Teacher account created. Share the temporary password with the teacher securely.");
      return;
    }

    if (formType === "create-class") {
      const studentNames = String(values.get("students")).split(/\r?\n/)
        .map(function (name) { return name.trim(); }).filter(Boolean);
      const teacherId = user.role === "admin" ? String(values.get("teacherId")) : user.id;
      if (!studentNames.length) {
        alert("Add at least one student to the class.");
        return;
      }
      if (!data.users.some(function (person) { return person.id === teacherId && person.role === "teacher"; })) {
        alert("Select a valid teacher for this class.");
        return;
      }
      data.classes.push({
        id: id(),
        name: String(values.get("name")).trim(),
        level: String(values.get("level")).trim(),
        room: String(values.get("room")).trim(),
        schedule: String(values.get("schedule")).trim(),
        teacherId: teacherId,
        students: studentNames.map(function (name) { return { id: id(), name: name }; }),
        createdAt: new Date().toISOString()
      });
      saveData(data);
      go("classes");
      return;
    }

    if (formType === "add-student") {
      const item = classFor(data, String(values.get("classId")));
      if (!item || (user.role !== "admin" && item.teacherId !== user.id)) {
        alert("You do not have permission to update this class.");
        return;
      }
      item.students.push({ id: id(), name: String(values.get("student")).trim() });
      saveData(data);
      go("class", { classId: item.id });
      return;
    }

    if (formType === "attendance") {
      const classId = String(values.get("classId"));
      const item = classFor(data, classId);
      if (!item || (user.role !== "admin" && item.teacherId !== user.id)) {
        alert("You do not have permission to update this attendance record.");
        return;
      }
      const date = String(values.get("date"));
      const entries = item.students.map(function (student) {
        return {
          studentId: student.id,
          name: student.name,
          status: String(values.get("status-" + student.id))
        };
      });
      if (entries.some(function (entry) { return entry.status !== "Present" && entry.status !== "Absent"; })) {
        alert("Choose Present or Absent for every student before saving.");
        return;
      }
      const existing = data.records.find(function (record) {
        return record.classId === classId && record.date === date;
      });
      const updated = {
        classId: classId, date: date, entries: entries, updatedAt: new Date().toISOString()
      };
      if (existing) Object.assign(existing, updated);
      else data.records.push(updated);
      saveData(data);
      go("attendance", { classId: classId, date: date });
      return;
    }

    if (formType === "profile") {
      const email = String(values.get("email")).trim().toLowerCase();
      if (data.users.some(function (person) {
        return person.id !== user.id && person.email.toLowerCase() === email;
      })) {
        alert("That email address is already in use.");
        return;
      }
      user.name = String(values.get("name")).trim();
      user.email = email;
      saveData(data);
      renderProfile(data, user);
      alert("Personal information saved.");
      return;
    }

    if (formType === "change-password") {
      const currentPassword = String(values.get("currentPassword"));
      const newPassword = String(values.get("newPassword"));
      if (currentPassword !== user.password) {
        alert("Current password is incorrect.");
        return;
      }
      if (newPassword.length < 8) {
        alert("Choose a password with at least 8 characters.");
        return;
      }
      user.password = newPassword;
      saveData(data);
      form.reset();
      alert("Password changed.");
    }
  }

  function handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "logout") {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = "login.html";
      return;
    }
    if (action === "print") {
      window.print();
      return;
    }
    if (action === "archive") {
      const data = loadData();
      const user = currentUser(data);
      if (!user) return;
      const report = activeReport(data, user);
      const exists = data.archives.some(function (item) {
        return item.start === report.start && item.end === report.end &&
          (user.role === "admin" || item.ownerId === user.id);
      });
      if (exists) {
        alert("A report for this week has already been archived.");
        return;
      }
      data.archives.push({
        id: id(), ownerId: user.id, start: report.start, end: report.end,
        rows: report.rows, createdAt: new Date().toISOString()
      });
      saveData(data);
      alert("Weekly attendance report archived.");
      go("archives");
      return;
    }
    if (action === "csv") {
      const data = loadData();
      const user = currentUser(data);
      if (!user) return;
      if (button.dataset.source === "archive") {
        const archive = data.archives.find(function (item) { return item.id === button.dataset.id; });
        if (archive) downloadCsv("attendance-" + archive.start + "-to-" + archive.end + ".csv", archive.rows);
      } else {
        const report = activeReport(data, user);
        downloadCsv("weekly-attendance-" + report.start + "-to-" + report.end + ".csv", report.rows);
      }
      return;
    }
    if (action === "print-archive") {
      const data = loadData();
      const archive = data.archives.find(function (item) { return item.id === button.dataset.id; });
      if (!archive) return;
      const user = currentUser(data);
      const rows = archive.rows.map(function (row) {
        return "<tr><td>" + dateLabel(row.date) + "</td><td>" + escapeHtml(row.className) +
          "</td><td>" + escapeHtml(row.student) + "</td><td>" + escapeHtml(row.status) + "</td></tr>";
      }).join("");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Allow pop-ups to print this archived report.");
        return;
      }
      printWindow.document.write(
        '<!doctype html><html><head><title>Archived attendance report</title><style>' +
        'body{font:14px Arial,sans-serif;margin:32px;color:#222}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#eee}</style>' +
        '</head><body><h1>Weekly attendance report</h1><p>' + dateLabel(archive.start) + " – " +
        dateLabel(archive.end) + '</p><p>Archived ' + new Date(archive.createdAt).toLocaleString() +
        '</p><table><thead><tr><th>Date</th><th>Class</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
        rows + '</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>'
      );
      printWindow.document.close();
      return;
    }
  }

  function handleFilterChange(event) {
    if (event.target.id === "attendance-class" || event.target.id === "attendance-date") {
      const classId = document.getElementById("attendance-class").value;
      const date = document.getElementById("attendance-date").value;
      if (classId && date) go("attendance", { classId: classId, date: date });
    }
    if (event.target.id === "report-week") {
      if (event.target.value) {
        go("reports", { weekStart: mondayOf(new Date(event.target.value + "T12:00:00")) });
      }
    }
  }

  function renderLogin() {
    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const passwordInput = document.getElementById(button.getAttribute("data-password-toggle"));
        if (!passwordInput) return;
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        button.textContent = isVisible ? "Show" : "Hide";
        button.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
        button.setAttribute("aria-pressed", String(!isVisible));
      });
    });

    const form = document.getElementById("login-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        let data;
        try {
          data = loadData();
        } catch (error) {
          document.getElementById("login-message").textContent = error.message;
          return;
        }
        const values = new FormData(form);
        const email = String(values.get("email")).trim().toLowerCase();
        const password = String(values.get("password"));
        const role = String(values.get("role"));
        const user = data.users.find(function (person) {
          return person.email.toLowerCase() === email && person.password === password && person.role === role;
        });
        if (!user) {
          document.getElementById("login-message").textContent = "Email, password, or account type is incorrect.";
          return;
        }
        localStorage.setItem(SESSION_KEY, user.id);
        go("dashboard");
      });
    }

    const resetLink = document.getElementById("show-reset");
    const resetForm = document.getElementById("reset-form");
    const loginView = document.getElementById("login-view");
    const cancelReset = document.getElementById("cancel-reset");
    if (resetLink && resetForm && loginView && cancelReset) {
      function closeReset() {
        resetForm.hidden = true;
        loginView.hidden = false;
        document.body.classList.remove("is-resetting");
      }

      resetLink.addEventListener("click", function (event) {
        event.preventDefault();
        document.getElementById("reset-message").textContent = "";
        loginView.hidden = true;
        resetForm.hidden = false;
        document.body.classList.add("is-resetting");
        document.getElementById("reset-email").focus();
      });
      cancelReset.addEventListener("click", function () {
        resetForm.reset();
        closeReset();
        resetLink.focus();
      });
      resetForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const resetMessage = document.getElementById("reset-message");
        resetMessage.textContent = "";
        let data;
        try {
          data = loadData();
        } catch (error) {
          resetMessage.textContent = error.message;
          return;
        }
        const values = new FormData(resetForm);
        const email = String(values.get("email")).trim().toLowerCase();
        const user = data.users.find(function (person) { return person.email.toLowerCase() === email; });
        if (!user) {
          resetMessage.textContent = "No account was found for that email.";
          return;
        }
        user.password = String(values.get("newPassword"));
        try {
          saveData(data);
        } catch (error) {
          resetMessage.textContent = "Could not save the new password in this browser. Please try again.";
          return;
        }
        document.getElementById("login-message").textContent = "Password reset for this browser prototype. You can now log in.";
        resetForm.reset();
        closeReset();
        document.getElementById("email").focus();
      });
    }
  }

  function start() {
    if (document.body.classList.contains("page-login")) {
      renderLogin();
      return;
    }
    if (!root) return;
    const data = loadData();
    const user = currentUser(data);
    if (!user) {
      window.location.replace("login.html");
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("view") || "dashboard";
    const view = viewNames[requested] ? requested : "dashboard";
    if (user.role !== "admin" && view === "staff") {
      go("dashboard");
      return;
    }
    const renderers = {
      dashboard: renderDashboard,
      classes: renderClasses,
      "create-class": renderCreateClass,
      class: renderClass,
      attendance: renderAttendance,
      reports: renderReports,
      archives: renderArchives,
      profile: renderProfile,
      staff: renderStaff
    };
    renderers[view](data, user);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleFilterChange);
  }

  try {
    start();
  } catch (error) {
    if (root) {
      root.innerHTML = '<main class="portal-main"><div class="portal-notice" role="alert">' +
        escapeHtml(error.message) + "</div></main>";
    } else {
      const message = document.getElementById("login-message");
      if (message) message.textContent = error.message;
    }
  }
})();
