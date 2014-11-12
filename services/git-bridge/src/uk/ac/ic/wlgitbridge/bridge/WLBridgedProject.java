package uk.ac.ic.wlgitbridge.bridge;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.model.Snapshot;

import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Created by Winston on 05/11/14.
 */
public class WLBridgedProject {

    private final Repository repository;
    private final String name;
    private final File repositoryDirectory;
    private final SnapshotDBAPI snapshotDBAPI;

    public WLBridgedProject(Repository repository, String name, File repositoryDirectory, SnapshotDBAPI snapshotDBAPI) {
        this.repository = repository;
        this.name = name;
        this.repositoryDirectory = repositoryDirectory;
        this.snapshotDBAPI = snapshotDBAPI;
    }

    public void buildRepository() throws RepositoryNotFoundException, ServiceNotEnabledException, FailedConnectionException {
        if (repository.getObjectDatabase().exists()) {
            updateRepositoryFromSnapshots(repository);
        } else {
            buildRepositoryFromScratch(repository);
        }
    }

    private void updateRepositoryFromSnapshots(Repository repository) throws ServiceNotEnabledException, RepositoryNotFoundException, FailedConnectionException {
        List<Snapshot> snapshotsToAdd;
        try {
            snapshotsToAdd = snapshotDBAPI.getSnapshotsToAddToProject(name);
        } catch (InvalidProjectException e) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            for (Snapshot snapshot : snapshotsToAdd) {
                snapshot.writeToDisk(repositoryDirectory.getAbsolutePath());
                Git git = new Git(repository);
                git.add().addFilepattern(".").call();
                git.commit().setAuthor(snapshot.getUserName(), snapshot.getUserEmail()).setMessage(snapshot.getComment()).call();
            }
        } catch (GitAPIException e) {
            throw new ServiceNotEnabledException();
        } catch (IOException e) {
            throw new ServiceNotEnabledException();
        }
    }

    private void buildRepositoryFromScratch(Repository repository) throws RepositoryNotFoundException, ServiceNotEnabledException, FailedConnectionException {
        if (!snapshotDBAPI.repositoryExists(name)) {
            throw new RepositoryNotFoundException(name);
        }
        try {
            repository.create();
        } catch (IOException e) {
            e.printStackTrace();
        }
        updateRepositoryFromSnapshots(repository);
    }

}
