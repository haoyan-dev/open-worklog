import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchProjects, createProject } from "../api";
import type { Project } from "../types";

interface ProjectAutocompleteProps {
  value: number | null; // project_id
  onChange: (projectId: number) => void;
  required?: boolean;
}

export default function ProjectAutocomplete({
  value,
  onChange,
  required = false,
}: ProjectAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateOption, setShowCreateOption] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Update input value when value prop changes (e.g., when editing existing entry)
  useEffect(() => {
    if (value && projects.length > 0) {
      const project = projects.find((p) => p.id === value);
      if (project) {
        setInputValue(project.name);
      }
    } else if (!value) {
      setInputValue("");
    }
  }, [value, projects]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const allProjects = await fetchProjects();
      setProjects(allProjects);
      setFilteredProjects(allProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchProjects = useCallback(async (searchTerm: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = searchTerm
          ? await fetchProjects(searchTerm)
          : await fetchProjects();
        setFilteredProjects(results);

        // Check if we should show "Create new project" option
        const exactMatch = results.find(
          (p) => p.name.toLowerCase() === searchTerm.toLowerCase()
        );
        setShowCreateOption(
          searchTerm.trim().length > 0 && !exactMatch && !isLoading
        );
      } catch (error) {
        console.error("Failed to search projects:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedIndex(-1);
    setIsOpen(true);
    searchProjects(newValue);
  };

  const handleSelectProject = (project: Project) => {
    setInputValue(project.name);
    onChange(project.id);
    setIsOpen(false);
    setSelectedIndex(-1);
    setShowCreateOption(false);
  };

  const handleCreateProject = async () => {
    if (!inputValue.trim()) return;

    try {
      setIsLoading(true);
      const newProject = await createProject(inputValue.trim());
      setProjects((prev) => [...prev, newProject]);
      setFilteredProjects((prev) => [...prev, newProject]);
      handleSelectProject(newProject);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project. It may already exist.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    const totalOptions = filteredProjects.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < totalOptions - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < filteredProjects.length) {
            handleSelectProject(filteredProjects[selectedIndex]);
          } else if (showCreateOption) {
            handleCreateProject();
          }
        } else if (showCreateOption && inputValue.trim()) {
          handleCreateProject();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    searchProjects(inputValue);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="project-autocomplete" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder="Type to search or create project..."
        required={required}
        autoComplete="off"
      />
      {isOpen && (filteredProjects.length > 0 || showCreateOption) && (
        <div className="project-autocomplete-dropdown">
          {isLoading && (
            <div className="project-autocomplete-item loading">Loading...</div>
          )}
          {!isLoading &&
            filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className={`project-autocomplete-item ${
                  index === selectedIndex ? "selected" : ""
                }`}
                onClick={() => handleSelectProject(project)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="project-autocomplete-item-name">
                  {project.name}
                </div>
                {project.description && (
                  <div className="project-autocomplete-item-description">
                    {project.description}
                  </div>
                )}
              </div>
            ))}
          {showCreateOption && !isLoading && (
            <div
              className={`project-autocomplete-item create ${
                selectedIndex === filteredProjects.length ? "selected" : ""
              }`}
              onClick={handleCreateProject}
              onMouseEnter={() => setSelectedIndex(filteredProjects.length)}
            >
              <div className="project-autocomplete-item-name">
                + Create "{inputValue.trim()}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
