/*
 *
 * Cloud code for Roommates
 * Written by Gjermund Bjaanes
 *
 */
 
/* Function for restting a users password
 *
 * Calls the Parse reset functions, but checks that the user is not a facebook-linked user.
 *
 * Input:
 * "username" : usernameStr, 
 * 
 * Output:
 * String
 *
 */
Parse.Cloud.define("resetPassword", function(request, response) {
	Parse.Cloud.useMasterKey();
	
	var email = request.params.username;
	
	var queryForUserToResetPassword = new Parse.Query(Parse.User);
	queryForUserToResetPassword.equalTo("email", email);
	
	queryForUserToResetPassword.first({
		success: function(user) {
			if (typeof user === "undefined") {
				response.error("Could not find user");
			} else {
				if (Parse.FacebookUtils.isLinked(user)) {
					response.error("This user is linked against Facebook. Log in with Facebook.");
				} else {
					Parse.User.requestPasswordReset(email, {
						success: function() {
							response.success("An email has been sent with instructions to reset your password");
						},
						error: function(error) {
							response.error("Error: " + error.code + " " + error.message);
						}
					});
				}
			}
		},
		error: function(error) {
			response.error("Could not get user. Try again.");
		}
	});
});

 
/* Before Delete for TaskList.
 * This hook is called every time someone tries to delete a task list
 * It makes sure that all task list elements and events that points to
 * the task list are also deleted. A Cascading thing really
 */
Parse.Cloud.beforeDelete("TaskList", function(request, response) {
	Parse.Cloud.useMasterKey();
	var taskList = request.object;
	
	// Check if taskList is defined
	if (typeof taskList === 'undefined') {
		response.error("Error. TaskList not defined.");
	}
	
	// Set up the task list elements query
	var queryForTaskListElements = new Parse.Query("TaskListElement");
	queryForTaskListElements.equalTo("taskList", taskList);
	
	// Set up the subquery for the event query
	var queryForTaskList = new Parse.Query("TaskList");
	queryForTaskList.equalTo("objectId", taskList.id);
	
	// Set up the event query
	var queryForEvents = new Parse.Query("Event");
	queryForEvents.matchesQuery("objects", queryForTaskList);
	
	/*
	 * Starts by doing the task list elements query,
	 * then deletes all task list elements.
	 * Followed by the event query and deletion of 
	 * the events
	 */
	queryForTaskListElements.find().then(function(taskListElements) {
	    return Parse.Object.destroyAll(taskListElements);
	}).then(function(success) {
		queryForEvents.find().then(function(events) {
			return Parse.Object.destroyAll(events);
		}).then(function(success) {
			response.success();
		}, function(error) {
			response.error("Could not delete eventes");	
		});
	}, function(error) {
		response.error("Could not delete ttask list elements");
	});
});

/* Before delete for Expense
 * Makes sure that all objects that points to expense are deleted
 */
Parse.Cloud.beforeDelete("Expense", function(request, response) {
	Parse.Cloud.useMasterKey();
	var expense = request.object;
	
	// Check if taskList is defined
	if (typeof expense === 'undefined') {
		response.error("Error. TaskList not defined.");
	}
	
	var queryForExpense = new Parse.Query("Expense");
	queryForExpense.equalTo("objectId", expense.id);
	
	var queryForEvents = new Parse.Query("Event");
	queryForEvents.matchesQuery("objects", queryForExpense);
	
	queryForEvents.find().then(function(events) {
		return Parse.Object.destroyAll(events);
	}).then(function(success) {
		response.success();
	}, function(error) {
		response.error("Could not delete events");	
	});
});


 /* After save function for Expense */
Parse.Cloud.afterSave("Expense", function(request) {
	Parse.Cloud.useMasterKey();
	var expense = request.object;
	
	var user = expense.get("owed");
	var household = expense.get("household");
	var householdRoleName =  "household-" + household.id;
	var eventACL = new Parse.ACL;
	eventACL.setRoleReadAccess(householdRoleName, true);

	
	if (expense.updatedAt.getTime() == expense.createdAt.getTime()) {
		var Event = Parse.Object.extend("Event");
		var event = new Event();
		event.set("household", household);
		event.set("type", 4);
		event.set("user", user);
		var array = [ expense ];
		event.set("objects", array);
		event.setACL(eventACL);
		event.save();
	}
	
	if (expense.get("notPaidUp").length === 0) {
		var Event = Parse.Object.extend("Event");
		var event = new Event();
		event.set("household", household);
		event.set("type", 5);
		event.set("user", user);
		var array = [ expense ];
		event.set("objects", array);
		event.setACL(eventACL);
		event.save();
	}
});

 
 
 /* After save function for Note */
 Parse.Cloud.afterSave("Note", function(request) {
 	Parse.Cloud.useMasterKey();
 	var note = request.object;
 	var household = note.get("household");
 	var currentUser = Parse.User.current();
 	var description = currentUser.get("displayName") + " wrote a new note";
 	
	var queryForInstallations = new Parse.Query(Parse.Installation);
	queryForInstallations.equalTo("household", household);
	queryForInstallations.notEqualTo("user", currentUser);
	
	Parse.Push.send({
	  where: queryForInstallations, // Set our Installation query
	  data: {
		alert: description
	  }
	}, {
	  success: function() {
		  console.log("Event Push Successful!");
	  },
	  error: function(error) {
		  console.log("Event Push Successful!");
	  }
	});
 	
 });
 
 /* After save function for TaskList */
 Parse.Cloud.afterSave("TaskList", function(request) {
 	 Parse.Cloud.useMasterKey();
 	 
 	 var taskList = request.object;
 	 var user = Parse.User.current();
 	 var household = taskList.get("household");
 	 var householdRoleName =  "household-" + household.id;
 	 var eventACL = new Parse.ACL;
 	 eventACL.setRoleReadAccess(householdRoleName, true);
 	 
 	 if (taskList.updatedAt.getTime() == taskList.createdAt.getTime()) {
	 	 // Set up Event
		var Event = Parse.Object.extend("Event");
		var event = new Event();
		event.set("household", household);
		event.set("type", 2);
		event.set("user", user);
		var array = [ taskList ];
		event.set("objects", array);
		event.setACL(eventACL);
		event.save();
 	 }
 	 
 	 if (taskList.get("done")) {
		// Set up Event
		var Event = Parse.Object.extend("Event");
		var event = new Event();
		event.set("household", household);
		event.set("type", 3);
		event.set("user", user);
		var array = [ taskList ];
		event.set("objects", array);
		event.setACL(eventACL);
		event.save();
 	 }
 });
 
/* After save function for Event that sends out Push notifications */
Parse.Cloud.afterSave("Event", function(request) {
	Parse.Cloud.useMasterKey();
	
	var event = request.object; // The event being saved
	
	//var householdChannel = "household-" + household.id;
	
	var type = event.get("type");
	
	var queryForTheEvent = new Parse.Query("Event");
	queryForTheEvent.include("user");
	queryForTheEvent.include("household");
	queryForTheEvent.include("objects");
	
	queryForTheEvent.get(event.id).then(function(fetchedEvent) {
		var description = "Something went wrong!";
		
		switch (type) {
		case 0: // join
			description = fetchedEvent.get("user").get("displayName") + " joined " + fetchedEvent.get("household").get("householdName");
			break;
		case 1: // leave
			description = fetchedEvent.get("user").get("displayName") + " left " + fetchedEvent.get("household").get("householdName");
			break;
		case 2: // add tasklist
			description = fetchedEvent.get("user").get("displayName") + " created a new task list: " + fetchedEvent.get("objects")[0].get("listName");
			break;
		case 3: // finish taskList
			description = fetchedEvent.get("user").get("displayName") + " finished task list: " + fetchedEvent.get("objects")[0].get("listName");
			break;
		case 4: // add expense
			description = fetchedEvent.get("user").get("displayName") + " added a new expense: " + fetchedEvent.get("objects")[0].get("name");
			break;
		case 5: // settled expense
			description = fetchedEvent.get("user").get("displayName") + " settled an expense: " + fetchedEvent.get("objects")[0].get("name");
			break;
				
		}
		
		var queryForInstallations = new Parse.Query(Parse.Installation);
		queryForInstallations.equalTo("household", fetchedEvent.get("household"));
		queryForInstallations.notEqualTo("user", fetchedEvent.get("user"));
		
		// Send push to the household channel for the event
		Parse.Push.send({
		  where: queryForInstallations, // Set our Installation query
		  data: {
			alert: description
		  }
		}, {
		  success: function() {
			  console.log("Event Push Successful!");
		  },
		  error: function(error) {
			  console.log("Event Push Successful!");
		  }
		});
		
	}, function(error) {
		console.log(error.message);
	});
	
	
	
	
});

/* Function for inviting a user to a household
 *
 * Input:
 * "username" : usernameStr, 
 * "householdId" : householdIdStr
 * 
 * Output:
 * String with information about the result (Can be shown to user)
 *
 */
Parse.Cloud.define("inviteUserToHousehold", function(request, response) {
	Parse.Cloud.useMasterKey();
	var username = request.params.username;
	var householdId = request.params.householdId;
	var currentUser = Parse.User.current();
	
	// Query for the invitee
	var queryForInvitee = new Parse.Query(Parse.User);
	queryForInvitee.equalTo("username", username);
	queryForInvitee.first({
		success: function(invitee) {
			if (typeof invitee === "undefined") response.error("Could not find user");
			
			// Query for the household
			var Household = Parse.Object.extend("Household");
			var queryForHousehold = new Parse.Query(Household);
			queryForHousehold.get(householdId, {
				success: function(household) {
					if (typeof household === "undefined") response.error("Could not find household");
					
					var Invitation = Parse.Object.extend("Invitation");
					
					// Check that the invitee has not been invited to this household already
					var queryForExistingInvitation = new Parse.Query(Invitation);
					queryForExistingInvitation.equalTo("invitee", invitee);
					queryForExistingInvitation.equalTo("household", household);
					queryForExistingInvitation.count({
						success: function(count) {
							console.log(count);
							if (count == 0) {
								// No invite exists, lets make a new one!
								
								// First set up ACL
								var householdRoleName = "household-" + householdId;
								var invitationACL = new Parse.ACL;
								invitationACL.setRoleReadAccess(householdRoleName, true);
								invitationACL.setReadAccess(invitee, true);
								
								var invitation = new Invitation();
								invitation.set("inviter", currentUser);
								invitation.set("invitee", invitee);
								invitation.set("household", household);
								invitation.setACL(invitationACL);
								invitation.save(null, {
									success: function(invitation) {
										// Invitation was sent, time to send a push notification to the invitee
										
										var queryForInstallations = new Parse.Query(Parse.Installation);
										queryForInstallations.equalTo("user", invitee);
										
										Parse.Push.send({
											where: queryForInstallations,
											data: {
												alert: "You just got invited to a new Household!"
											}
										}, {
											success: function() {
											  	response.success(invitation);
											},
											error: function(error) {
											  	response.success(invitation);
											}
										}); 
									},
									error: function(object, error) {
										response.error("Could not save invitation");
									}
								}); // END INVITATION SAVE
							}
							else {
								response.error("User has already been invited to this Household");	
							}
						},
						error: function(error) {
							response.error("Could not retrieve invitations. Try again.");	
						}
					}); // END INVITATION QUERY
				},
				error: function(error) {
					response.error("Could not find household.");
				}
			}); // END HOUSEHOLD QUERY
		},
		error: function(error) {
			response.error("Could not get user. Try again.");
		}
	}); // END USER QUERY
	
});


// TODO: Remove input and just user currentUser to query for the householdmembers
/* Function for getting the householdmembers of a household
 *
 * Input:
 * TO BE REMOVED
 * 
 * Output:
 * Success: Array with the users of the household
 * Error: String with useful informationt
 */
Parse.Cloud.define("getHouseholdMembers", function(request, response) {
	Parse.Cloud.useMasterKey();
	var householdRoleName =  "household-" + request.params.householdId;
	
	// Query for the household role
	var queryForHouseholdRole = new Parse.Query(Parse.Role);
	queryForHouseholdRole.equalTo("name", householdRoleName);
	queryForHouseholdRole.first({
		success: function(householdRole) {
			if (typeof householdRole === "undefined") response.error("Could not find household");
			
			// Query for the household members
			var householdMemberRelation = householdRole.getUsers();
			var queryForHouseholdMembers = householdMemberRelation.query();
			queryForHouseholdMembers.find({
				success: function(householdMembers) {
					if (typeof householdMembers === "undefined") 
						response.error("Could not get household members");
					else 
						response.success(householdMembers);
				},
				error: function(error) {
					response.error("Could not get household members");
				}
			}); // END HOUSEHOLD MEMBERS QUERY
		},
		error: function(error) {
			response.error("Could not get household. Try again.");
		}
	}); // END ROLE QUERY
});

// TODO: Remove input?
/* Function for leaving a household
 *
 * Input:
 * TO BE REMOVED
 * 
 * Output:
 * String with useful information
 *
 */
Parse.Cloud.define("leaveHousehold", function(request, response) {
	Parse.Cloud.useMasterKey();
	var currentUser = Parse.User.current();
	var householdId = request.params.householdId;
	
	// Query for the household role
	var householdRoleName =  "household-" + householdId;
	var queryForHouseholdRole = new Parse.Query(Parse.Role);
	queryForHouseholdRole.equalTo("name", householdRoleName);
	queryForHouseholdRole.first({
		success: function(householdRole) {
			if (typeof householdRole === "undefined") response.error("Could not find household.");
			
			// Remove the user from the household role (aka. remove all access (ACL)
			householdRole.getUsers().remove(currentUser);
			householdRole.save(null, {
				success: function(householdRole) {
					currentUser.unset("activeHousehold");
					currentUser.save(null, {
						success: function(currentUser) {
							// User is now ok, time to let the other members of the household know that the user left.
							// Query for the household and then create an event for the household.
							var Household = Parse.Object.extend("Household");
							var queryForHousehold = new Parse.Query(Household);
							queryForHousehold.get(householdId, {
								success: function(household) {
									// Create new event
									
									// First set up ACL
									var eventACL = new Parse.ACL;
									eventACL.setRoleReadAccess(householdRoleName, true);
									
									var Event = Parse.Object.extend("Event");
									var event = new Event();
									var user = currentUser.get("displayName");
									event.set("household", household);
									event.set("type", 1);
									event.set("user", currentUser);
									event.setACL(eventACL);
									event.save();
									response.success("User left the household and notifications were sent out.");
								},
								error: function(error) {
									 // Its still a success, but no notifacionts
									response.success("User left the household, but notifications failed.");
								}
							}); // END HOUSEHOLD QUERY
						},
						error: function(object, error) {
							response.error("User has lost permissions, but active household failed to be removed");
						}
					}); // END USER SAVE
				},
				error: function(object, error) {
					response.error("Failed to leave household. Try again.");
				}
			}); // END ROLE SAVE
		},
		error: function(object, error) {
			response.error("Failed to leave household. Try again.");
		}
	}); // END ROLE QUERY
});


// Burde denne sjekke om current user er invitee?
// withParameters:@{@"invitationId" : invitationObjectId}
/* Function for accepting an invitation
 *
 * Input:
 * invitationId : invitationObjectId
 * 
 * Output:
 * String
 *
 */
Parse.Cloud.define("acceptInvitation", function(request, response) {
	Parse.Cloud.useMasterKey();
	var currentUser = Parse.User.current();
	
	// Query for the invitation
	var Invitation = Parse.Object.extend("Invitation");
	var queryForInvitation = new Parse.Query(Invitation);
	queryForInvitation.include("household");
	queryForInvitation.get(request.params.invitationId, {
		success: function(invitation) {
			if (typeof invitation === "undefined") response.error("Could not find invitation.")
			// Query for the householdRole
			var household = invitation.get("household");
			var householdRoleName =  "household-" + household.id;
			var queryForHouseholdRole = new Parse.Query(Parse.Role);
			queryForHouseholdRole.equalTo("name", householdRoleName);
			queryForHouseholdRole.first({
				success: function(householdRole) {
					// Add user to the household role
					householdRole.getUsers().add(currentUser);
					householdRole.save(null, {
						success: function(householdRole) {
							// Set household as active
							currentUser.set("activeHousehold", household);
							currentUser.save(null, {
								success: function(currentUser) {
									// Everyting is now OK, but we need to get rid of the invitation-object now
									invitation.destroy({
										success: function(object) {
											// Everyting went A-OK and we create the event
											
											// First set up ACL
											var eventACL = new Parse.ACL;
											eventACL.setRoleReadAccess(householdRoleName, true);
											
											var Event = Parse.Object.extend("Event");
											var event = new Event();
											var user = currentUser.get("displayName");
											event.set("type", 0);
											event.set("user", currentUser);
											event.set("household", household);
											event.setACL(eventACL);
											event.save();
											response.success("Invitation accepted successfuly.");	
										},
										error: function(object, error) {
											console.log("Invitation not destroyed: " + invitation.id);
										    response.success("Invitation accepted successfuly.");
										}
									}); // END INVITATION DESTRUCTION
								},
								error: function(object, error) {
									response.error("Could not save user.");
								}
							}); // END USER SAVE
						},
						error: function(object, error) {
							response.error("Could not add user to household");
						}
					}); // END ROLE SAVE
				},
				error: function(object, error) {
					response.error("Could not find household.");
				}
			}); // END ROLE QUERY
		},
		error: function(object, error) {
			response.error("Could not find invitation.");
		}
	}); // END INVITATION QUERY
});



/* Function for creating a new invitation
 *
 * Creates a new household and adds current user to the household.
 *
 * Input:
 * "householdName" : "Household Name"
 * 
 * Output:
 * String
 *
 */
Parse.Cloud.define("createNewHousehold", function(request, response) {
	Parse.Cloud.useMasterKey();
	var householdName = request.params.householdName;
	var currentUser = Parse.User.current();
	
	// Create a new household
	var Household = Parse.Object.extend("Household");
	var household = new Household();
	household.set("householdName", householdName);
	
	// Save household before doing anything else (we need it's ID to continue)
	household.save(null, {
		success: function(household) {
			// household is now saved
			
			// Make a new household role
			var householdRoleACL = new Parse.ACL();
			householdRoleACL.setPublicReadAccess(true);
			var householdRole = new Parse.Role("household-"+household.id, householdRoleACL);
			householdRole.getUsers().add(currentUser);
			
			// Save role before adding it to household
			householdRole.save(null, {
				success: function(householdRole) {
					// Set the household ACL
					var householdACL = new Parse.ACL();
					householdACL.setPublicReadAccess(true);
					householdACL.setPublicWriteAccess(false);
					householdACL.setRoleReadAccess(householdRole, true);
					householdACL.setRoleWriteAccess(householdRole, true);
					household.setACL(householdACL);
					
					// Set the role to be its own ACL-role (Its kinda wierd, but it is how it works for *NOW*!)
					var newHouseholdRoleACL = new Parse.ACL();
					newHouseholdRoleACL.setPublicReadAccess(false);
					newHouseholdRoleACL.setPublicWriteAccess(false);
					newHouseholdRoleACL.setRoleReadAccess(householdRole, true);
					newHouseholdRoleACL.setRoleWriteAccess(householdRole, true);
					householdRole.setACL(newHouseholdRoleACL);
					
					// Time to save the role and household for the last time
					householdRole.save(null, {
						success: function(householdRole) {
							household.save(null, {
								success: function(household) {
									currentUser.set("activeHousehold", household);
									currentUser.save(null, {
										success: function(currentUser) {
											response.success(household);
										},
										error: function(object, error) {
											response.error("Not able to save users active household");
										}
									});
								},
								error: function(household, error) {
									response.error("Not able to save household for the second time");
								}
							}); // END SECOND HOUSEHOLD SAVE
						},
						error: function(household, error) {
							response.error("Not able to save household role for the second time");
						}
					}); // END SECOND HOUSEHOLD ROLE SAVE
				},
				error: function(householdRole) {
					response.error("Not able to create household role");
				}
			}); // END ROLE SAVE
		}, // END HOUSEHOLD SUCCESS
		error: function(household, error) {
			response.error("Not able to create a new household");
		}
	}); // END HOUSEHOLD SAVE
});