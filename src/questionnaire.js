// jshint -W069

function Questionnaire() {

	var self = this;

	var currentPage 	= null;
	var savedResults 	= {};

	var pageCounter 	= 0;
	var started 		= false;

	this.Container 	= null;
	this.Pages 		= [];

	this._eventListeners = {};
	this.addEventListener = function(eventName, callback) {

		if (typeof eventName !== 'string') {

			throw new Error('The specified event name is invalid.');
		}

		// strip "on" in front of event name and lowercase it
		eventName = eventName.replace(/^on/i, '').toLowerCase();

		if (self._eventListeners[eventName] === undefined) {

			self._eventListeners[eventName] = [];
		}
		self._eventListeners[eventName].push(callback);
	};
	this.emit = function(eventName, target) {

		var returnedFalse = false;

		if (self._eventListeners[eventName] !== undefined) {

			var callbackCount = self._eventListeners[eventName].length;
			for (var i = 0; i < callbackCount; i++) {

				var f = self._eventListeners[eventName][i];
				if (f(self, target) === false) {

					returnedFalse = true;
				}
			}
		}

		return ( returnedFalse ? false : true );
	};

	this.addPage = function(page) {

		pageCounter 	= (self.Pages.length + 1);
		page.PageNumber = pageCounter;

		page.Questionnaire = self;
		self.Pages.push(page);
	};

	this.getRecentPage = function() {

		if (currentPage !== null) {

			return currentPage;
		}

		return ( (self.Pages.length >= 1) ? self.Pages[0] : null );
	};

	this.getCurrentPage = function() {

		return currentPage;
	};

	this.getPrevPage = function() {

		var currentPage = self.getCurrentPage();

		if (currentPage !== null) {

			var pageIndex = 0;
			if (currentPage.PageNumber >= 2) {

				// offset is 2 because PageNumber starts at 1 and array starts at 0
				pageIndex = (currentPage.PageNumber - 2);
			}

			return self.Pages[pageIndex];
		}
	};

	this.getNextPage = function() {

		var currentPage = self.getCurrentPage();

		if (currentPage !== null) {

			var totalPageCount = self.getTotalPageCount();

			var pageIndex = (totalPageCount - 1);
			if (currentPage.PageNumber < totalPageCount) {

				// no offset because PageNumber already starts at 1
				pageIndex = currentPage.PageNumber;
			}

			return self.Pages[pageIndex];
		}
	};

	this.getTotalPageCount = function() {

		return pageCounter;
	};

	this.canGoBack = function() {

		var currentPage = self.getCurrentPage();
		if (currentPage !== null) {

			return (currentPage.PageNumber >= 2);
		}

		return false;
	};

	this.canGoForward = function() {

		var currentPage = self.getCurrentPage();
		if (currentPage !== null) {

			return (currentPage.PageNumber < self.getTotalPageCount());
		}

		return false;
	};

	this.goBack = function() {

		if (!self.canGoBack()) { return false; }

		currentPage = self.getPrevPage();
		self.render(self.Container, currentPage);
	};

	this.goForward = function() {

		if (!self.canGoForward()) { return false; }

		currentPage = self.getNextPage();
		self.render(self.Container, currentPage);
	};

	this.getSavedResult = function(question) {

		var results = savedResults[question.Page.PageNumber];
		if (results !== undefined) {

			var questionCount = results.length;
			for (var i = 0; i < questionCount; i++) {

				if (results[i].question === question) {

					return results[i].answer;
				}
			}
		}

		return null;
	};

	this.saveAnswers = function() {

		var currentPage = self.getCurrentPage();
		if (currentPage !== null) {

			var result = currentPage.getAnswers();

			savedResults[currentPage.PageNumber] = result;
		}
	};

	this.render = function(container, page) {

		if (!container || (typeof container.appendChild !== 'function')) {

			throw new Error('No DOM element provided to render the questionnaire into.');
		}

		// fire event: start
		if (!started && (self.emit('start') === false)) {

			return false;
		}
		started = true;

		if (page === undefined) {

			page = self.getRecentPage();
		}

		self.Container 	= container;
		currentPage 	= page;

		// clear container
		self.clear(self.Container);

		var wrapper = document.createElement('div');
		wrapper.classList.add('questionnaire');

		// prepare page container
		var pageContainer = document.createElement('div');
		pageContainer.classList.add('pages');
		self.renderPage(pageContainer);

		// prepare controls
		var controlsContainer = document.createElement('div');
		controlsContainer.classList.add('controls');
		self.renderControls(controlsContainer);

		wrapper.appendChild(pageContainer);
		wrapper.appendChild(controlsContainer);

		container.appendChild(wrapper);

		return true;
	};

	this.renderPage = function(container) {

		if (!container || (typeof container.appendChild !== 'function')) {

			throw new Error('No DOM element provided to render the questionnaire page(s) into.');
		}

		if (currentPage !== null) {

			// fire event: pagechanged
			self.emit('pagechanged', currentPage);

			// render page
			currentPage.render(container);

		} else {

			throw new Error('No page to render.');
		}
	};

	this.renderControls = function(container) {

		if (!container || (typeof container.appendChild !== 'function')) {

			throw new Error('No DOM element provided to render the questionnaire controls into.');
		}

		var wrapper = document.createElement('div');
		wrapper.classList.add('actions');

		if ( self.canGoBack() ) {

			var backButton = document.createElement('button');
			backButton.type = 'button';
			backButton.classList.add('action', 'back');
			backButton.textContent = Questionnaire.l10n.buttons.back;

			backButton.addEventListener('click', function() {

				// fire event: prev
				if (currentPage.emit('prev') !== false) {

					self.saveAnswers();
					self.goBack();
				}
			});

			wrapper.appendChild(backButton);
		}

		if ( self.canGoForward() ) {

			var nextButton = document.createElement('button');
			nextButton.type = 'submit';
			nextButton.classList.add('action', 'next');
			nextButton.textContent = Questionnaire.l10n.buttons.next;

			nextButton.addEventListener('click', function() {

				// validate
				if (currentPage.validate() === true) {

					// fire event: next
					if (currentPage.emit('next') !== false) {

						self.saveAnswers();
						self.goForward();
					}
				}
			});

			wrapper.appendChild(nextButton);

		// if there are no pages remaining, the questionnaire will be finished
		} else {

			var finishButton = document.createElement('button');
			finishButton.type = 'submit';
			finishButton.classList.add('action', 'finish');
			finishButton.textContent = Questionnaire.l10n.buttons.finish;

			finishButton.addEventListener('click', function() {

				// fire event: next
				if (currentPage.emit('next') !== false) {

					self.saveAnswers();
					self.renderResult(self.Container);
				}
			});

			wrapper.appendChild(finishButton);
		}

		container.appendChild(wrapper);
	};

	this.renderResult = function(container) {

		// clear container
		self.clear(container);

		// fire event: finished
		if (self.emit('finished') === false) {

			var resultNode = document.createElement('div');
			resultNode.classList.add('result');

			// render all decisions
			var pageCount = self.Pages.length;
			for (var p = 0; p < pageCount; p++) {

				var page = self.Pages[p];

				var questionCount = page.Questions.length;
				for (var q = 0; q < questionCount; q++) {

					var question 	= page.Questions[q];
					var answerText 	= question.getAnswer();

					var wrapperNode = document.createElement('div');
					wrapperNode.classList.add('question');

					var questionNode = document.createElement('p');
					questionNode.classList.add('text');
					questionNode.textContent = question.Text;
					wrapperNode.appendChild(questionNode);

					var answerNode = document.createElement('p');
					answerNode.classList.add('answer');
					answerNode.textContent = answerText;
					wrapperNode.appendChild(answerNode);

					resultNode.appendChild(wrapperNode);
				}

				container.appendChild(resultNode);
			}
		}
	};

	this.clear = function(container) {

		if (!container || (typeof container.appendChild !== 'function')) {

			return false;
		}

		while (container.firstChild) {

			container.removeChild(container.firstChild);
		}

		return true;
	};
}

function Page() {

	var self = this;

	this.Questionnaire 	= null;
	this.PageNumber 	= -1;
	this.Questions 		= [];

	this._eventListeners = {};
	this.addEventListener = function(eventName, callback) {

		if (typeof eventName !== 'string') {

			throw new Error('The specified event name is invalid.');
		}

		// strip "on" in front of event name and lowercase it
		eventName = eventName.replace(/^on/i, '').toLowerCase();

		if (self._eventListeners[eventName] === undefined) {

			self._eventListeners[eventName] = [];
		}
		self._eventListeners[eventName].push(callback);
	};
	this.emit = function(eventName, target) {

		var returnedFalse = false;

		if (self._eventListeners[eventName] !== undefined) {

			var callbackCount = self._eventListeners[eventName].length;
			for (var i = 0; i < callbackCount; i++) {

				var f = self._eventListeners[eventName][i];
				if (f(self, target) === false) {

					returnedFalse = true;
				}
			}
		}

		if (!returnedFalse) {

			self.Questionnaire.emit(eventName);
		}

		return ( returnedFalse ? false : true );
	};

	this.addQuestion = function(question) {

		question.Page = self;
		self.Questions.push(question);
	};

	this.validate = function() {

		var questionCount = self.Questions.length;
		for (var i = 0; i < questionCount; i++) {

			if (self.Questions[i].validate() === false) {

				return false;
			}
		}

		return true;
	};

	this.getSavedResult = function(question) {

		return self.Questionnaire.getSavedResult(question);
	};

	this.getAnswers = function() {

		var result = [];

		var questionCount = self.Questions.length;
		for (var i = 0; i < questionCount; i++) {

			result.push({
				question: 	self.Questions[i],
				answer: 	self.Questions[i].getAnswer()
			});
		}

		return result;
	};

	this.render = function(container) {

		if (!container || (typeof container.appendChild !== 'function')) {

			throw new Error('No DOM element provided to render the page.');
		}

		var wrapper = document.createElement('div');
		wrapper.classList.add('page');

		// render questions
		var questionCount = self.Questions.length;
		for (var i = 0; i < questionCount; i++) {

			self.Questions[i].render(wrapper);
		}
		container.appendChild(wrapper);

		// fire event: shown
		self.emit('shown');
	};
}

function Question(text, validation) {

	var self 				= this;
	var sharedName 			= Questionnaire.generateUUID();
	var validationClassName = 'validation-error';

	this.Page 		= null;
	this.Text 		= text;
	this.Answers 	= [];
	this.Options 	= ( (typeof validation === 'object') ? validation : {} );

	this.Node 		= null;

	this._eventListeners = {};
	this.addEventListener = function(eventName, callback) {

		if (typeof eventName !== 'string') {

			throw new Error('The specified event name is invalid.');
		}

		// strip "on" in front of event name and lowercase it
		eventName = eventName.replace(/^on/i, '').toLowerCase();

		if (self._eventListeners[eventName] === undefined) {

			self._eventListeners[eventName] = [];
		}
		self._eventListeners[eventName].push(callback);
	};
	this.emit = function(eventName, target) {

		var returnedFalse = false;

		if (self._eventListeners[eventName] !== undefined) {

			var callbackCount = self._eventListeners[eventName].length;
			for (var i = 0; i < callbackCount; i++) {

				var f = self._eventListeners[eventName][i];
				if (f(self, target) === false) {

					returnedFalse = true;
				}
			}
		}

		if (!returnedFalse) {

			self.Page.emit(eventName);
		}

		return ( returnedFalse ? false : true );
	};

	this.addAnswer = function(answer) {

		answer.Question = self;
		self.Answers.push(answer);
	};

	this.validate = function() {

		var isRequired 	= (self.Options.required === true);
		var min 		= ( (typeof self.Options.min === 'number') ? self.Options.min : -1 );
		var max 		= ( (typeof self.Options.max === 'number') ? self.Options.max : -1 );
		var callback 	= self.Options.callback;

		var answerValue = self.getAnswer();

		// required
		if (isRequired) {

			if (answerValue === null) {

				self.showError(Questionnaire.l10n.validation.required);
				return false;
			}
		}

		// min
		if (min > 0) {

			switch (typeof answerValue) {

				case 'string':

					if (answerValue.length < min) {

						self.showError(Questionnaire.l10n.validation.minString, min);
						return false;
					}
				break;

				case 'number':

					if (answerValue < min) {

						self.showError(Questionnaire.l10n.validation.minNumber, min);
						return false;
					}
				break;

				case 'object':

					// array
					if (Array.isArray(answerValue)) {

						if (answerValue.length < min) {

							self.showError(Questionnaire.l10n.validation.minArray, min);
							return false;
						}
					}
				break;

				default:

					console.warn('Unknown answer type encountered.', answerValue);
					self.showError(Questionnaire.l10n.validation.generic);
					return false;
			}
		}

		// max
		if (max > 0) {

			switch (typeof answerValue) {

				case 'string':

					if (answerValue.length > max) {

						self.showError(Questionnaire.l10n.validation.maxString, max);
						return false;
					}
				break;

				case 'number':

					if (answerValue > max) {

						self.showError(Questionnaire.l10n.validation.maxNumber, max);
						return false;
					}
				break;

				case 'object':

					// array
					if (Array.isArray(answerValue)) {

						if (answerValue.length > max) {

							self.showError(Questionnaire.l10n.validation.maxArray, max);
							return false;
						}
					}
				break;

				default:

					console.warn('Unknown answer type encountered.', answerValue);
					self.showError(Questionnaire.l10n.validation.generic);
					return false;
			}
		}

		// callback
		if (typeof callback === 'function') {

			var cbResult = callback(answerValue);

			if (cbResult === false) {

				self.showError(Questionnaire.l10n.validation.generic);
				return false;

			} else if (typeof cbResult === 'string') {

				self.showError(cbResult, answerValue);
				return false;
			}
		}

		self.hideError();
		return true;
	};

	this.showError = function(message, placeholder) {

		if (typeof message !== 'string') {

			console.warn('The provided value for argument "message" was not of type string.', message);
			message = Questionnaire.l10n.validation.generic;
		}

		var node = self.Node.querySelector('.' + validationClassName);
		if (node === null) {

			node = document.createElement('div');
			node.classList.add(validationClassName);

			// prepend node
			self.Node.insertBefore(node, self.Node.firstChild);
		}

		node.textContent 	= message.replace('{{n}}', placeholder);
		node.style.display 	= 'block';
	};
	this.hideError = function() {

		var node = self.Node.querySelector('.' + validationClassName);
		if (node !== null) {

			node.textContent = '';
			node.style.display = 'none';
		}
	};

	this.getExistingAnswer = function() {

		return self.Page.getSavedResult(self);
	};

	this.getAnswer = function() {

		var answerCount = self.Answers.length;
		for (var i = 0; i < answerCount; i++) {

			var answerValue = self.Answers[i].getAnswer(sharedName);

			if (answerValue !== null) {

				return answerValue;
			}
		}

		return null;
	};

	this.render = function(container) {

		var wrapper = document.createElement('div');
		wrapper.classList.add('question');

		var questionNode = document.createElement('p');
		questionNode.classList.add('text');
		questionNode.textContent = self.Text;
		wrapper.appendChild(questionNode);

		var answersWrapper = document.createElement('div');
		answersWrapper.classList.add('answers');

		var answerCount = self.Answers.length;
		for (var i = 0; i < answerCount; i++) {

			self.Answers[i].render(answersWrapper, sharedName);
		}
		wrapper.appendChild(answersWrapper);

		self.Node = wrapper;
		container.appendChild(wrapper);
	};
}

function Answer() {

	var self = this;

	this.Question = null;

	this._eventListeners = {};
	this.addEventListener = function(eventName, callback) {

		if (typeof eventName !== 'string') {

			throw new Error('The specified event name is invalid.');
		}

		// strip "on" in front of event name and lowercase it
		eventName = eventName.replace(/^on/i, '').toLowerCase();

		if (self._eventListeners[eventName] === undefined) {

			self._eventListeners[eventName] = [];
		}
		self._eventListeners[eventName].push(callback);
	};
	this.emit = function(eventName, target) {

		var returnedFalse = false;

		if (self._eventListeners[eventName] !== undefined) {

			var callbackCount = self._eventListeners[eventName].length;
			for (var i = 0; i < callbackCount; i++) {

				var f = self._eventListeners[eventName][i];
				if (f(self, target) === false) {

					returnedFalse = true;
				}
			}
		}

		if (!returnedFalse) {

			self.Question.emit(eventName);
		}

		return ( returnedFalse ? false : true );
	};

	// return true to let the answer pass validation
	this.validate = function() {

		throw new Error('Abstract class "Answer" does not offer a default implementation for this method.');
	};

	// return null to indicate that the user did not interact with this answer
	this.getAnswer = function() {

		throw new Error('Abstract class "Answer" does not offer a default implementation for this method.');
	};

	// create and append DOM node to the provided container
	this.render = function() {

		throw new Error('Abstract class "Answer" does not offer a default implementation for this method.');
	};
}

	function AnswerBySingleChoice(label, value) /* extends Answer */ {

		// inherit from Answer
		Answer.call(this);

		var self = this;
		var inputNode;

		this.getAnswer = function(name) {

			var parentNode 	= inputNode.parentNode;
			var result 		= parentNode.querySelector('[name="' + name + '"]:checked');

			if (result !== null) {

				return result.value;
			}

			return null;
		};

		this.render = function(container, name) {

			var wrapper = document.createElement('div');
			wrapper.classList.add('answer', 'choice', 'single');

			inputNode 		= document.createElement('input');
			inputNode.name 	= name;
			inputNode.id 	= Questionnaire.generateUUID();
			inputNode.type 	= 'radio';
			inputNode.value = ( (value !== undefined) ? value : label );

			// attempt to restore answered value
			var existingAnswer = self.Question.getExistingAnswer();
			if (existingAnswer !== null) {

				if (inputNode.value === existingAnswer) {

					inputNode.checked = true;
				}
			}

			inputNode.addEventListener('change', function() {

				// fire event: answered
				self.emit('answered');
			});

			wrapper.appendChild(inputNode);

			var labelNode = document.createElement('label');
			labelNode.setAttribute('for', inputNode.id);
			labelNode.textContent = label;
			wrapper.appendChild(labelNode);

			container.appendChild(wrapper);
		};
	}

	function AnswerByMultipleChoice(label, value) /* extends Answer */ {

		// inherit from Answer
		Answer.call(this);

		var self = this;
		var inputNode;

		this.getAnswer = function(name) {

			var parentNode 	= inputNode.parentNode.parentNode;
			var result 		= parentNode.querySelectorAll('[name="' + name + '"]:checked');

			if (result !== null) {

				var list = [];

				var checkedCount = result.length;
				for (var i = 0; i < checkedCount; i++) {

					list.push(result[i].value);
				}

				return list;
			}

			return null;
		};

		this.render = function(container, name) {

			var wrapper = document.createElement('div');
			wrapper.classList.add('answer', 'choice', 'multiple');

			inputNode 		= document.createElement('input');
			inputNode.name 	= name;
			inputNode.id 	= Questionnaire.generateUUID();
			inputNode.type 	= 'checkbox';
			inputNode.value = ( (value !== undefined) ? value : label );

			// attempt to restore answered value
			var existingAnswer = self.Question.getExistingAnswer();
			if (existingAnswer !== null) {

				if (existingAnswer.indexOf(inputNode.value) >= 0) {

					inputNode.checked = true;
				}
			}

			inputNode.addEventListener('change', function() {

				// fire event: answered
				self.emit('answered');
			});

			wrapper.appendChild(inputNode);

			var labelNode = document.createElement('label');
			labelNode.setAttribute('for', inputNode.id);
			labelNode.textContent = label;
			wrapper.appendChild(labelNode);

			container.appendChild(wrapper);
		};
	}

	function AnswerByTextInput(placeholder) /* extends Answer */ {

		// inherit from Answer
		Answer.call(this);

		var self = this;
		var inputNode;

		this.getAnswer = function() {

			return ( (inputNode.value.length > 0) ? inputNode.value : null );
		};

		this.render = function(container) {

			var wrapper = document.createElement('div');
			wrapper.classList.add('answer', 'text', 'single');

			inputNode = document.createElement('input');
			inputNode.type = 'text';

			if (typeof placeholder === 'string') {

				inputNode.setAttribute('placeholder', placeholder);
			}

			// attempt to restore answered value
			var existingAnswer = self.Question.getExistingAnswer();
			if (existingAnswer !== null) {

				inputNode.value = existingAnswer;
			}

			inputNode.addEventListener('input', function() {

				// fire event: answered
				self.emit('answered');
			});

			wrapper.appendChild(inputNode);

			container.appendChild(wrapper);
		};
	}

	function AnswerHint(text) /* extends Answer */ {

		// inherit from Answer
		Answer.call(this);

		var self = this;

		this.getAnswer = function() {

			return null;
		};

		this.render = function(container) {

			var node = document.createElement('p');
			node.classList.add('hint');
			node.textContent = text;

			container.appendChild(node);
		};
	}

Questionnaire.generateUUID = function() {

	var d = new Date().getTime();
	if ((typeof performance !== 'undefined') && (typeof performance.now === 'function')) {

		d += performance.now();
	}

	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {

		var r = (d + Math.random() * 16) % 16 | 0;
		d = Math.floor(d / 16);
		return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	});
};

Questionnaire.l10n = {

	buttons: {
		back: 	'< Back',
		next: 	'Next >',
		finish: 'Finish >'
	},

	validation: {
		required: 	'Please answer this question to continue.',
		minString: 	'Please enter at least {{n}} character(s).',
		maxString: 	'Please enter no more than {{n}} character(s).',
		minNumber: 	'Please enter a number greater than {{n}}.',
		maxNumber: 	'Please enter a number less than {{n}}.',
		minArray: 	'Please choose at least {{n}} option(s).',
		maxArray: 	'Please choose at most {{n}} option(s).',
		generic: 	'Please answer this question to continue.'
	}

};